import CoreTelephony
import Foundation

@objcMembers
public final class CellularInfoProvider: NSObject {
  private let networkInfo = CTTelephonyNetworkInfo()

  public func cellularInfo() -> NSDictionary {
    let technologies = networkInfo.serviceCurrentRadioAccessTechnology ?? [:]
    let dataService = networkInfo.dataServiceIdentifier

    let technology: String? = {
      if let dataService, let dataTechnology = technologies[dataService] {
        return dataTechnology
      }
      if technologies.count == 1 {
        return technologies.values.first
      }
      return nil
    }()

    let generation = technology.flatMap(Self.generation(for:))
    let normalizedTechnology = technology.flatMap(Self.shortTechnologyName(for:))
    let available = technology != nil

    return [
      "available": available,
      "operator": NSNull(),
      "radioTechnology": normalizedTechnology.map { $0 as Any } ?? NSNull(),
      "generation": generation.map { $0 as Any } ?? NSNull(),
      "signalDbm": NSNull(),
      "signalLevel": NSNull(),
      "isRoaming": NSNull(),
      "platform": "ios",
    ] as NSDictionary
  }

  private static func generation(for technology: String) -> String? {
    switch technology {
    case CTRadioAccessTechnologyGPRS,
         CTRadioAccessTechnologyEdge,
         CTRadioAccessTechnologyCDMA1x:
      return "2G"
    case CTRadioAccessTechnologyWCDMA,
         CTRadioAccessTechnologyHSDPA,
         CTRadioAccessTechnologyHSUPA,
         CTRadioAccessTechnologyCDMAEVDORev0,
         CTRadioAccessTechnologyCDMAEVDORevA,
         CTRadioAccessTechnologyCDMAEVDORevB,
         CTRadioAccessTechnologyeHRPD:
      return "3G"
    case CTRadioAccessTechnologyLTE:
      return "4G"
    case CTRadioAccessTechnologyNRNSA,
         CTRadioAccessTechnologyNR:
      return "5G"
    default:
      return nil
    }
  }

  private static func shortTechnologyName(for technology: String) -> String? {
    switch technology {
    case CTRadioAccessTechnologyGPRS: return "GPRS"
    case CTRadioAccessTechnologyEdge: return "EDGE"
    case CTRadioAccessTechnologyCDMA1x: return "CDMA1x"
    case CTRadioAccessTechnologyWCDMA: return "WCDMA"
    case CTRadioAccessTechnologyHSDPA: return "HSDPA"
    case CTRadioAccessTechnologyHSUPA: return "HSUPA"
    case CTRadioAccessTechnologyCDMAEVDORev0: return "EVDO_0"
    case CTRadioAccessTechnologyCDMAEVDORevA: return "EVDO_A"
    case CTRadioAccessTechnologyCDMAEVDORevB: return "EVDO_B"
    case CTRadioAccessTechnologyeHRPD: return "eHRPD"
    case CTRadioAccessTechnologyLTE: return "LTE"
    case CTRadioAccessTechnologyNRNSA: return "NRNSA"
    case CTRadioAccessTechnologyNR: return "NR"
    default: return nil
    }
  }
}
