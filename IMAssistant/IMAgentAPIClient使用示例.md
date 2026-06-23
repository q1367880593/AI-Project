# IMAgentAPIClient 使用示例

## 1. 配置 Host 和签名

```objc
IMAgentAPIClient *client = [IMAgentAPIClient sharedClient];
client.host = @"http://127.0.0.1:8000";

@weakify(self);
client.headerProvider = ^NSDictionary *(NSDictionary *params) {
    @strongify(self);
    NSString *timeSp = [NSString stringWithFormat:@"%ld", (long)[[NSDate date] timeIntervalSince1970]];
    NSMutableDictionary *signParams = [params mutableCopy] ?: [NSMutableDictionary dictionary];
    signParams[@"request_ts"] = timeSp;

    NSString *signStr = [self addHeaderWithParams:signParams];
    return @{
        @"X-Signature": SAFESTRING(signStr)
    };
};
```

## 2. C 端累计上传用户画像、行为、消息

```objc
[[IMAgentAPIClient sharedClient] updateConversationWithConversationId:@"c_001"
                                                         userProfile:@{
    @"budget_range": @[@5000, @6500],
    @"target_area": @"朝阳",
    @"room_type_preference": @"一居室"
}
                                                     propertyContext:@{
    @"community": @"望京花园",
    @"district": @"朝阳",
    @"price": @5800,
    @"layout": @"一居室"
}
                                                           behaviors:@[
    @{@"type": @"view_vr"},
    @{@"type": @"favorite"},
    @{@"type": @"property_view", @"duration_seconds": @45}
]
                                                            messages:@[
    @{@"sender": @"user", @"content": @"周末能看吗？", @"message_type": @"text"}
]
                                                             success:^(NSDictionary *result) {
    NSLog(@"analysis = %@", result);
} failure:^(NSError *error) {
    NSLog(@"error = %@", error);
}];
```

## 3. B 端订阅当前是否留资窗口

```objc
@property (nonatomic, strong) NSURLSessionDataTask *agentWindowTask;

self.agentWindowTask = [[IMAgentAPIClient sharedClient] startWindowStreamWithConversationId:@"c_001"
                                                                                    onEvent:^(NSDictionary *analysis) {
    BOOL shouldPrompt = [analysis[@"should_prompt_agent"] boolValue];
    NSString *promptLevel = analysis[@"prompt_level"];
    NSString *suggestedReply = analysis[@"suggested_reply"];

    if (shouldPrompt && [promptLevel isEqualToString:@"strong"]) {
        // 展示“现在适合引导留电话”提示卡
        // 点击一键填入时，将 suggestedReply 填入输入框
        NSLog(@"建议话术：%@", suggestedReply);
    }
} onFailure:^(NSError *error) {
    NSLog(@"stream error = %@", error);
}];
```

离开聊天页时取消订阅：

```objc
[self.agentWindowTask cancel];
self.agentWindowTask = nil;
```

## 4. 经纪人点击“换一种说法”时流式获取话术

```objc
[[IMAgentAPIClient sharedClient] startReplyStreamWithConversationId:@"c_001"
                                                             onText:^(NSString *text) {
    // 增量追加到输入框或候选话术区域
    NSLog(@"delta text = %@", text);
} onFailure:^(NSError *error) {
    NSLog(@"reply stream error = %@", error);
}];
```

## 5. 经纪人行为反馈

```objc
[[IMAgentAPIClient sharedClient] sendFeedbackWithConversationId:@"c_001"
                                                   suggestionId:nil
                                                    agentAction:@"accepted"
                                                  finalSentText:@"这套周末可以约看，我先帮您确认房东和钥匙时间。方便留个电话吗？"
                                                  userLeftPhone:@YES
                                                  phoneLeftTime:@([[NSDate date] timeIntervalSince1970] * 1000)
                                                        success:^(NSDictionary *result) {
    NSLog(@"feedback ok = %@", result);
} failure:^(NSError *error) {
    NSLog(@"feedback error = %@", error);
}];
```
