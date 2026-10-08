#import "RCTNativeCellularInfo.h"
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "NetworkQosMonitor-Swift.h"

@implementation RCTNativeCellularInfo {
  CellularInfoProvider *_provider;
}

- (instancetype)init
{
  if (self = [super init]) {
    _provider = [CellularInfoProvider new];
  }
  return self;
}

- (void)getCellularInfo:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  @try {
    resolve([_provider cellularInfo]);
  } @catch (NSException *exception) {
    resolve(@{
      @"available": @NO,
      @"operator": [NSNull null],
      @"radioTechnology": [NSNull null],
      @"generation": [NSNull null],
      @"signalDbm": [NSNull null],
      @"signalLevel": [NSNull null],
      @"isRoaming": [NSNull null],
      @"platform": @"ios",
    });
  }
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCellularInfoSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"NativeCellularInfo";
}

@end
