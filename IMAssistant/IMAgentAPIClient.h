#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void(^IMAgentSuccessBlock)(NSDictionary *result);
typedef void(^IMAgentFailureBlock)(NSError *error);
typedef void(^IMAgentWindowEventBlock)(NSDictionary *analysis);
typedef void(^IMAgentStreamTextBlock)(NSString *text);
typedef NSDictionary *_Nullable(^IMAgentHeaderProvider)(NSDictionary *params);

@interface IMAgentAPIClient : NSObject

@property (nonatomic, copy) NSString *host;
@property (nonatomic, copy, nullable) IMAgentHeaderProvider headerProvider;

+ (instancetype)sharedClient;

- (void)updateConversationWithConversationId:(NSString *)conversationId
                                 userProfile:(nullable NSDictionary *)userProfile
                             propertyContext:(nullable NSDictionary *)propertyContext
                                   behaviors:(nullable NSArray<NSDictionary *> *)behaviors
                                    messages:(nullable NSArray<NSDictionary *> *)messages
                                     success:(IMAgentSuccessBlock)success
                                     failure:(IMAgentFailureBlock)failure;

- (void)analyzeWithConversationId:(NSString *)conversationId
                     latestMessage:(nullable NSDictionary *)latestMessage
                       userProfile:(nullable NSDictionary *)userProfile
                   propertyContext:(nullable NSDictionary *)propertyContext
                   recentBehaviors:(nullable NSArray<NSDictionary *> *)recentBehaviors
                conversationHistory:(nullable NSArray<NSDictionary *> *)conversationHistory
                            success:(IMAgentSuccessBlock)success
                            failure:(IMAgentFailureBlock)failure;

- (NSURLSessionDataTask *)startWindowStreamWithConversationId:(NSString *)conversationId
                                                      onEvent:(IMAgentWindowEventBlock)onEvent
                                                    onFailure:(nullable IMAgentFailureBlock)onFailure;

- (NSURLSessionDataTask *)startReplyStreamWithConversationId:(NSString *)conversationId
                                                      onText:(IMAgentStreamTextBlock)onText
                                                   onFailure:(nullable IMAgentFailureBlock)onFailure;

- (void)sendFeedbackWithConversationId:(NSString *)conversationId
                          suggestionId:(nullable NSString *)suggestionId
                            agentAction:(NSString *)agentAction
                         finalSentText:(nullable NSString *)finalSentText
                         userLeftPhone:(nullable NSNumber *)userLeftPhone
                          phoneLeftTime:(nullable NSNumber *)phoneLeftTime
                                success:(IMAgentSuccessBlock)success
                                failure:(IMAgentFailureBlock)failure;

@end

NS_ASSUME_NONNULL_END
