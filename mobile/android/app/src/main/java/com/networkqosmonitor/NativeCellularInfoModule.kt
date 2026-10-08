package com.networkqosmonitor

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellSignalStrength
import android.telephony.CellSignalStrengthCdma
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthTdscdma
import android.telephony.CellSignalStrengthWcdma
import android.telephony.SignalStrength
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class NativeCellularInfoModule(
  reactContext: ReactApplicationContext,
) : NativeCellularInfoSpec(reactContext) {

  override fun getName(): String = NAME

  override fun getCellularInfo(promise: Promise) {
    try {
      promise.resolve(readCellularInfo())
    } catch (_: Exception) {
      promise.resolve(unavailableInfo())
    } catch (_: LinkageError) {
      promise.resolve(unavailableInfo())
    }
  }

  private fun readCellularInfo(): WritableMap {
    val context = reactApplicationContext
    val hasTelephony = context.packageManager.hasSystemFeature(
      PackageManager.FEATURE_TELEPHONY_RADIO_ACCESS,
    )
    if (!hasTelephony) return unavailableInfo()

    val manager = getDataTelephonyManager() ?: return unavailableInfo()
    val hasBasicPhoneState = Build.VERSION.SDK_INT >= 33 &&
      context.checkSelfPermission(Manifest.permission.READ_BASIC_PHONE_STATE) ==
      PackageManager.PERMISSION_GRANTED

    val radioType = if (hasBasicPhoneState) {
      try {
        manager.dataNetworkType
      } catch (_: SecurityException) {
        TelephonyManager.NETWORK_TYPE_UNKNOWN
      } catch (_: UnsupportedOperationException) {
        TelephonyManager.NETWORK_TYPE_UNKNOWN
      }
    } else {
      TelephonyManager.NETWORK_TYPE_UNKNOWN
    }

    val technology = networkTypeName(radioType)
    val generation = networkTypeGeneration(radioType)
    val operator = safeOperatorName(manager)
    val roaming = if (hasBasicPhoneState) safeRoaming(manager) else null
    val (signalDbm, signalLevel) = safeSignal(manager, radioType)
    val available = operator != null || technology != null || signalDbm != null

    return Arguments.createMap().apply {
      putBoolean("available", available)
      putNullableString("operator", operator)
      putNullableString("radioTechnology", technology)
      putNullableString("generation", generation)
      putNullableInt("signalDbm", signalDbm)
      putNullableInt("signalLevel", signalLevel)
      putNullableBoolean("isRoaming", roaming)
      putString("platform", "android")
    }
  }

  private fun getDataTelephonyManager(): TelephonyManager? {
    val base = reactApplicationContext.getSystemService(TelephonyManager::class.java)
      ?: return null

    if (Build.VERSION.SDK_INT < 30) return base

    return try {
      val activeDataSubscriptionId = SubscriptionManager.getActiveDataSubscriptionId()
      if (activeDataSubscriptionId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
        base
      } else {
        base.createForSubscriptionId(activeDataSubscriptionId)
      }
    } catch (_: Exception) {
      base
    }
  }

  private fun safeOperatorName(manager: TelephonyManager): String? = try {
    manager.networkOperatorName.trim().takeIf(String::isNotEmpty)
  } catch (_: Exception) {
    null
  }

  private fun safeRoaming(manager: TelephonyManager): Boolean? = try {
    manager.isNetworkRoaming
  } catch (_: Exception) {
    null
  }

  private fun safeSignal(
    manager: TelephonyManager,
    networkType: Int,
  ): Pair<Int?, Int?> {
    if (Build.VERSION.SDK_INT < 28) return null to null

    val strength = try {
      manager.signalStrength
    } catch (_: Exception) {
      null
    } ?: return null to null

    if (Build.VERSION.SDK_INT < 29) {
      return null to strength.level.takeIf { it > CellSignalStrength.SIGNAL_STRENGTH_NONE_OR_UNKNOWN }
    }

    val matchingSignal = try {
      signalForNetworkType(strength, networkType)
        ?: strength.cellSignalStrengths.maxByOrNull(CellSignalStrength::getLevel)
    } catch (_: Exception) {
      null
    } ?: return null to null

    val dbm = matchingSignal.dbm.takeIf { it != Int.MAX_VALUE && it < 0 }
    val level = matchingSignal.level.takeIf {
      it > CellSignalStrength.SIGNAL_STRENGTH_NONE_OR_UNKNOWN
    }
    return dbm to level
  }

  private fun signalForNetworkType(
    strength: SignalStrength,
    networkType: Int,
  ): CellSignalStrength? {
    val targetClass = when (networkType) {
      TelephonyManager.NETWORK_TYPE_LTE,
      19 -> CellSignalStrengthLte::class.java
      20 -> Class.forName("android.telephony.CellSignalStrengthNr")
      TelephonyManager.NETWORK_TYPE_GSM,
      TelephonyManager.NETWORK_TYPE_GPRS,
      TelephonyManager.NETWORK_TYPE_EDGE -> CellSignalStrengthGsm::class.java
      TelephonyManager.NETWORK_TYPE_UMTS,
      TelephonyManager.NETWORK_TYPE_HSDPA,
      TelephonyManager.NETWORK_TYPE_HSUPA,
      TelephonyManager.NETWORK_TYPE_HSPA,
      TelephonyManager.NETWORK_TYPE_HSPAP -> CellSignalStrengthWcdma::class.java
      17 -> CellSignalStrengthTdscdma::class.java
      TelephonyManager.NETWORK_TYPE_CDMA,
      TelephonyManager.NETWORK_TYPE_1xRTT,
      TelephonyManager.NETWORK_TYPE_EVDO_0,
      TelephonyManager.NETWORK_TYPE_EVDO_A,
      TelephonyManager.NETWORK_TYPE_EVDO_B -> CellSignalStrengthCdma::class.java
      else -> null
    } ?: return null

    return strength.cellSignalStrengths.firstOrNull { targetClass.isInstance(it) }
  }

  private fun networkTypeGeneration(networkType: Int): String? = when (networkType) {
    TelephonyManager.NETWORK_TYPE_GPRS,
    TelephonyManager.NETWORK_TYPE_EDGE,
    TelephonyManager.NETWORK_TYPE_CDMA,
    TelephonyManager.NETWORK_TYPE_1xRTT,
    TelephonyManager.NETWORK_TYPE_IDEN,
    TelephonyManager.NETWORK_TYPE_GSM -> "2G"
    TelephonyManager.NETWORK_TYPE_UMTS,
    TelephonyManager.NETWORK_TYPE_EVDO_0,
    TelephonyManager.NETWORK_TYPE_EVDO_A,
    TelephonyManager.NETWORK_TYPE_HSDPA,
    TelephonyManager.NETWORK_TYPE_HSUPA,
    TelephonyManager.NETWORK_TYPE_HSPA,
    TelephonyManager.NETWORK_TYPE_EVDO_B,
    TelephonyManager.NETWORK_TYPE_EHRPD,
    TelephonyManager.NETWORK_TYPE_HSPAP,
    TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "3G"
    TelephonyManager.NETWORK_TYPE_LTE,
    19 -> "4G"
    20 -> "5G"
    else -> null
  }

  private fun networkTypeName(networkType: Int): String? = when (networkType) {
    TelephonyManager.NETWORK_TYPE_GPRS -> "GPRS"
    TelephonyManager.NETWORK_TYPE_EDGE -> "EDGE"
    TelephonyManager.NETWORK_TYPE_UMTS -> "UMTS"
    TelephonyManager.NETWORK_TYPE_CDMA -> "CDMA"
    TelephonyManager.NETWORK_TYPE_EVDO_0 -> "EVDO_0"
    TelephonyManager.NETWORK_TYPE_EVDO_A -> "EVDO_A"
    TelephonyManager.NETWORK_TYPE_1xRTT -> "1xRTT"
    TelephonyManager.NETWORK_TYPE_HSDPA -> "HSDPA"
    TelephonyManager.NETWORK_TYPE_HSUPA -> "HSUPA"
    TelephonyManager.NETWORK_TYPE_HSPA -> "HSPA"
    TelephonyManager.NETWORK_TYPE_IDEN -> "iDEN"
    TelephonyManager.NETWORK_TYPE_EVDO_B -> "EVDO_B"
    TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
    TelephonyManager.NETWORK_TYPE_EHRPD -> "EHRPD"
    TelephonyManager.NETWORK_TYPE_HSPAP -> "HSPAP"
    TelephonyManager.NETWORK_TYPE_GSM -> "GSM"
    TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "TD_SCDMA"
    TelephonyManager.NETWORK_TYPE_IWLAN -> "IWLAN"
    19 -> "LTE_CA"
    20 -> "NR"
    else -> null
  }

  private fun unavailableInfo(): WritableMap = Arguments.createMap().apply {
    putBoolean("available", false)
    putNull("operator")
    putNull("radioTechnology")
    putNull("generation")
    putNull("signalDbm")
    putNull("signalLevel")
    putNull("isRoaming")
    putString("platform", "android")
  }

  private fun WritableMap.putNullableString(key: String, value: String?) {
    if (value == null) putNull(key) else putString(key, value)
  }

  private fun WritableMap.putNullableInt(key: String, value: Int?) {
    if (value == null) putNull(key) else putInt(key, value)
  }

  private fun WritableMap.putNullableBoolean(key: String, value: Boolean?) {
    if (value == null) putNull(key) else putBoolean(key, value)
  }

  companion object {
    const val NAME = "NativeCellularInfo"
  }
}
