#import "IMAgentAPIClient.h"
#import <AFNetworking/AFNetworking.h>

static NSString * const kIMAgentDefaultHost = @"http://127.0.0.1:8000";

@interface IMAgentSSEDelegate : NSObject <NSURLSessionDataDelegate>

@property (nonatomic, copy) IMAgentWindowEventBlock analysisBlock;
@property (nonatomic, copy) IMAgentStreamTextBlock textBlock;
@property (nonatomic, copy, nullable) IMAgentFailureBlock failureBlock;
@property (nonatomic, copy, nullable) void(^completionBlock)(void);
@property (nonatomic, strong) NSMutableString *buffer;

@end

@implementation IMAgentSSEDelegate

- (instancetype)init {
    self = [super init];
    if (self) {
        _buffer = [NSMutableString string];
    }
    return self;
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data {
    NSString *chunk = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (chunk.length == 0) {
        return;
    }

    [self.buffer appendString:chunk];
    [self parseBufferedEvents];
}

- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
didCompleteWithError:(NSError *)error {
    if (error && error.code != NSURLErrorCancelled && self.failureBlock) {
        dispatch_async(dispatch_get_main_queue(), ^{
            self.failureBlock(error);
        });
    }
    if (self.completionBlock) {
        self.completionBlock();
    }
}

- (void)parseBufferedEvents {
    while (YES) {
        NSRange range = [self.buffer rangeOfString:@"\n\n"];
        if (range.location == NSNotFound) {
            break;
        }

        NSString *eventText = [self.buffer substringToIndex:range.location];
        [self.buffer deleteCharactersInRange:NSMakeRange(0, range.location + range.length)];
        [self handleEventText:eventText];
    }
}

- (void)handleEventText:(NSString *)eventText {
    NSArray<NSString *> *lines = [eventText componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]];
    NSString *eventName = nil;
    NSMutableString *dataString = [NSMutableString string];

    for (NSString *line in lines) {
        if ([line hasPrefix:@"event:"]) {
            eventName = [[line substringFromIndex:6] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
        } else if ([line hasPrefix:@"data:"]) {
            NSString *value = [[line substringFromIndex:5] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
            [dataString appendString:value];
        }
    }

    if (dataString.length == 0) {
        return;
    }

    NSData *jsonData = [dataString dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *payload = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:nil];
    if (![payload isKindOfClass:[NSDictionary class]]) {
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        if ([eventName isEqualToString:@"analysis"] && self.analysisBlock) {
            self.analysisBlock(payload);
        } else if ([eventName isEqualToString:@"delta"] && self.textBlock) {
            NSString *text = payload[@"text"];
            if ([text isKindOfClass:[NSString class]]) {
                self.textBlock(text);
            }
        }
    });
}

@end

@interface IMAgentAPIClient ()

@property (nonatomic, strong) NSHashTable<IMAgentSSEDelegate *> *streamDelegates;

@end

@implementation IMAgentAPIClient

+ (instancetype)sharedClient {
    static IMAgentAPIClient *client = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        client = [[IMAgentAPIClient alloc] init];
    });
    return client;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _host = kIMAgentDefaultHost;
        _streamDelegates = [NSHashTable hashTableWithOptions:NSPointerFunctionsStrongMemory];
    }
    return self;
}

- (void)updateConversationWithConversationId:(NSString *)conversationId
                                 userProfile:(NSDictionary *)userProfile
                             propertyContext:(NSDictionary *)propertyContext
                                   behaviors:(NSArray<NSDictionary *> *)behaviors
                                    messages:(NSArray<NSDictionary *> *)messages
                                     success:(IMAgentSuccessBlock)success
                                     failure:(IMAgentFailureBlock)failure {
    NSMutableDictionary *params = [NSMutableDictionary dictionary];
    params[@"conversation_id"] = conversationId ?: @"";
    if (userProfile) {
        params[@"user_profile"] = userProfile;
    }
    if (propertyContext) {
        params[@"property_context"] = propertyContext;
    }
    params[@"behaviors"] = behaviors ?: @[];
    params[@"messages"] = messages ?: @[];

    [self postPath:@"/agent/conversation/update" params:params success:success failure:failure];
}

- (void)analyzeWithConversationId:(NSString *)conversationId
                     latestMessage:(NSDictionary *)latestMessage
                       userProfile:(NSDictionary *)userProfile
                   propertyContext:(NSDictionary *)propertyContext
                   recentBehaviors:(NSArray<NSDictionary *> *)recentBehaviors
                conversationHistory:(NSArray<NSDictionary *> *)conversationHistory
                            success:(IMAgentSuccessBlock)success
                            failure:(IMAgentFailureBlock)failure {
    NSMutableDictionary *params = [NSMutableDictionary dictionary];
    params[@"conversation_id"] = conversationId ?: @"";
    if (latestMessage) {
        params[@"latest_message"] = latestMessage;
    }
    params[@"user_profile"] = userProfile ?: @{};
    params[@"property_context"] = propertyContext ?: @{};
    params[@"recent_behaviors"] = recentBehaviors ?: @[];
    params[@"conversation_history"] = conversationHistory ?: @[];

    [self postPath:@"/agent/analyze" params:params success:success failure:failure];
}

- (NSURLSessionDataTask *)startWindowStreamWithConversationId:(NSString *)conversationId
                                                      onEvent:(IMAgentWindowEventBlock)onEvent
                                                    onFailure:(IMAgentFailureBlock)onFailure {
    NSString *path = [NSString stringWithFormat:@"/agent/window/stream?conversation_id=%@", [self urlEncode:conversationId ?: @""]];
    IMAgentSSEDelegate *delegate = [[IMAgentSSEDelegate alloc] init];
    delegate.analysisBlock = onEvent;
    delegate.failureBlock = onFailure;
    return [self startSSEWithPath:path delegate:delegate];
}

- (NSURLSessionDataTask *)startReplyStreamWithConversationId:(NSString *)conversationId
                                                      onText:(IMAgentStreamTextBlock)onText
                                                   onFailure:(IMAgentFailureBlock)onFailure {
    NSString *path = [NSString stringWithFormat:@"/agent/reply/stream?conversation_id=%@", [self urlEncode:conversationId ?: @""]];
    IMAgentSSEDelegate *delegate = [[IMAgentSSEDelegate alloc] init];
    delegate.textBlock = onText;
    delegate.failureBlock = onFailure;
    return [self startSSEWithPath:path delegate:delegate];
}

- (void)sendFeedbackWithConversationId:(NSString *)conversationId
                          suggestionId:(NSString *)suggestionId
                            agentAction:(NSString *)agentAction
                         finalSentText:(NSString *)finalSentText
                         userLeftPhone:(NSNumber *)userLeftPhone
                          phoneLeftTime:(NSNumber *)phoneLeftTime
                                success:(IMAgentSuccessBlock)success
                                failure:(IMAgentFailureBlock)failure {
    NSMutableDictionary *params = [NSMutableDictionary dictionary];
    params[@"conversation_id"] = conversationId ?: @"";
    params[@"agent_action"] = agentAction ?: @"ignored";
    if (suggestionId) {
        params[@"suggestion_id"] = suggestionId;
    }
    if (finalSentText) {
        params[@"final_sent_text"] = finalSentText;
    }
    if (userLeftPhone) {
        params[@"user_left_phone"] = userLeftPhone;
    }
    if (phoneLeftTime) {
        params[@"phone_left_time"] = phoneLeftTime;
    }

    [self postPath:@"/agent/feedback" params:params success:success failure:failure];
}

- (void)postPath:(NSString *)path
          params:(NSDictionary *)params
         success:(IMAgentSuccessBlock)success
         failure:(IMAgentFailureBlock)failure {
    AFHTTPSessionManager *manager = [AFHTTPSessionManager manager];
    manager.securityPolicy.validatesDomainName = NO;
    manager.responseSerializer = [AFHTTPResponseSerializer serializer];
    manager.responseSerializer.acceptableContentTypes = [NSSet setWithObjects:@"application/json", @"text/json", @"text/javascript", @"text/html", nil];
    manager.requestSerializer = [AFJSONRequestSerializer serializer];

    NSMutableDictionary *headers = [NSMutableDictionary dictionary];
    if (self.headerProvider) {
        NSDictionary *providedHeaders = self.headerProvider(params);
        if (providedHeaders) {
            [headers addEntriesFromDictionary:providedHeaders];
        }
    }

    NSString *urlString = [NSString stringWithFormat:@"%@%@", self.host ?: kIMAgentDefaultHost, path];
    [manager POST:urlString
       parameters:params
          headers:headers
         progress:nil
          success:^(NSURLSessionDataTask * _Nonnull task, id  _Nullable responseObject) {
        NSDictionary *result = [self dictionaryFromResponseObject:responseObject];
        if (success) {
            success(result ?: @{});
        }
    } failure:^(NSURLSessionDataTask * _Nullable task, NSError * _Nonnull error) {
        if (failure) {
            failure(error);
        }
    }];
}

- (NSURLSessionDataTask *)startSSEWithPath:(NSString *)path delegate:(IMAgentSSEDelegate *)delegate {
    NSString *urlString = [NSString stringWithFormat:@"%@%@", self.host ?: kIMAgentDefaultHost, path];
    NSURL *url = [NSURL URLWithString:urlString];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.HTTPMethod = @"GET";
    [request setValue:@"text/event-stream" forHTTPHeaderField:@"Accept"];
    [request setValue:@"no-cache" forHTTPHeaderField:@"Cache-Control"];

    NSMutableDictionary *headerParams = [NSMutableDictionary dictionary];
    NSURLComponents *components = [NSURLComponents componentsWithString:urlString];
    for (NSURLQueryItem *item in components.queryItems) {
        if (item.name.length > 0 && item.value) {
            headerParams[item.name] = item.value;
        }
    }
    if (self.headerProvider) {
        NSDictionary *providedHeaders = self.headerProvider(headerParams);
        [providedHeaders enumerateKeysAndObjectsUsingBlock:^(id key, id obj, BOOL *stop) {
            if ([key isKindOfClass:[NSString class]] && [obj isKindOfClass:[NSString class]]) {
                [request setValue:obj forHTTPHeaderField:key];
            }
        }];
    }

    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
    NSURLSession *session = [NSURLSession sessionWithConfiguration:configuration delegate:delegate delegateQueue:nil];
    NSURLSessionDataTask *task = [session dataTaskWithRequest:request];

    @synchronized (self) {
        [self.streamDelegates addObject:delegate];
    }
    __weak typeof(self) weakSelf = self;
    __weak typeof(delegate) weakDelegate = delegate;
    delegate.completionBlock = ^{
        __strong typeof(weakSelf) strongSelf = weakSelf;
        __strong typeof(weakDelegate) strongDelegate = weakDelegate;
        if (!strongSelf || !strongDelegate) {
            return;
        }
        @synchronized (strongSelf) {
            [strongSelf.streamDelegates removeObject:strongDelegate];
        }
    };

    [task resume];
    return task;
}

- (NSDictionary *)dictionaryFromResponseObject:(id)responseObject {
    if ([responseObject isKindOfClass:[NSDictionary class]]) {
        return responseObject;
    }
    if (![responseObject isKindOfClass:[NSData class]]) {
        return nil;
    }

    NSError *error = nil;
    id json = [NSJSONSerialization JSONObjectWithData:responseObject options:0 error:&error];
    if (error || ![json isKindOfClass:[NSDictionary class]]) {
        return nil;
    }
    return json;
}

- (NSString *)urlEncode:(NSString *)value {
    NSCharacterSet *allowed = [NSCharacterSet URLQueryAllowedCharacterSet];
    return [value stringByAddingPercentEncodingWithAllowedCharacters:allowed] ?: @"";
}

@end
