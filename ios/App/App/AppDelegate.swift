import UIKit
import Capacitor
import CoreLocation
import StoreKit
import UserNotifications
import WeatherKit

private let safarMatePremiumProductID = "com.planetearthkh.safarmate.premium.lifetime"
private let safarMateLegacyPremiumMaximumBuild = 154

@objc(SafarMateStorePlugin)
public class SafarMateStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SafarMateStorePlugin"
    public let jsName = "SafarMateStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    @objc public func getStatus(_ call: CAPPluginCall) {
        Task {
            let status = await premiumStatus()
            call.resolve(status)
        }
    }

    @objc public func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Product.products(for: [safarMatePremiumProductID]).first else {
                    var status = await premiumStatus()
                    status["outcome"] = "failed"
                    call.resolve(status)
                    return
                }

                switch try await product.purchase() {
                case .success(let verificationResult):
                    switch verificationResult {
                    case .verified(let transaction):
                        await transaction.finish()
                        var status = await premiumStatus()
                        status["outcome"] = "purchased"
                        call.resolve(status)
                    case .unverified:
                        call.reject("The App Store could not verify this purchase.")
                    }
                case .pending:
                    var status = await premiumStatus()
                    status["outcome"] = "pending"
                    call.resolve(status)
                case .userCancelled:
                    var status = await premiumStatus()
                    status["outcome"] = "cancelled"
                    call.resolve(status)
                @unknown default:
                    var status = await premiumStatus()
                    status["outcome"] = "failed"
                    call.resolve(status)
                }
            } catch {
                call.reject("Premium purchase failed.", nil, error)
            }
        }
    }

    @objc public func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var status = await premiumStatus()
                status["outcome"] = (status["entitled"] as? Bool == true) ? "purchased" : "failed"
                call.resolve(status)
            } catch {
                call.reject("Purchases could not be restored.", nil, error)
            }
        }
    }

    private func premiumStatus() async -> [String: Any] {
        let product = try? await Product.products(for: [safarMatePremiumProductID]).first
        let purchased = await hasVerifiedPremiumEntitlement()
        let legacy = await legacyPremiumStatus()
        let entitled = purchased || legacy.grandfathered

        var result: [String: Any] = [
            "available": product != nil,
            "entitled": entitled,
            "grandfathered": legacy.grandfathered,
            "productId": safarMatePremiumProductID,
            "source": legacy.grandfathered ? "legacy" : (purchased ? "purchase" : "none")
        ]
        if let product {
            result["displayPrice"] = product.displayPrice
            result["displayName"] = product.displayName
            result["productDescription"] = product.description
        }
        if let originalAppVersion = legacy.originalAppVersion {
            result["originalAppVersion"] = originalAppVersion
        }
        return result
    }

    private func hasVerifiedPremiumEntitlement() async -> Bool {
        for await verificationResult in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verificationResult else { continue }
            if transaction.productID == safarMatePremiumProductID {
                return true
            }
        }
        return false
    }

    private func legacyPremiumStatus() async -> (grandfathered: Bool, originalAppVersion: String?) {
        guard #available(iOS 16.0, *) else {
            // AppTransaction is unavailable before iOS 16. Customers on iOS 15 can
            // still unlock or restore Premium through the verified IAP entitlement.
            return (false, nil)
        }
        return await legacyPremiumStatusForIOS16AndLater()
    }

    @available(iOS 16.0, *)
    private func legacyPremiumStatusForIOS16AndLater() async -> (grandfathered: Bool, originalAppVersion: String?) {
        do {
            let verificationResult = try await AppTransaction.shared
            guard case .verified(let appTransaction) = verificationResult else {
                return (false, nil)
            }

            let originalAppVersion = appTransaction.originalAppVersion
            guard appTransaction.environment == .production else {
                // Apple reports originalAppVersion as "1.0" in Sandbox and Xcode
                // testing. Never grant legacy access in those environments.
                return (false, originalAppVersion)
            }
            guard let originalBuild = Int(originalAppVersion) else {
                return (false, originalAppVersion)
            }
            return (originalBuild <= safarMateLegacyPremiumMaximumBuild, originalAppVersion)
        } catch {
            return (false, nil)
        }
    }
}

@objc(SafarMateWeatherPlugin)
public class SafarMateWeatherPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SafarMateWeatherPlugin"
    public let jsName = "SafarMateWeather"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "forecast", returnType: CAPPluginReturnPromise)
    ]

    @objc public func forecast(_ call: CAPPluginCall) {
        guard let latitude = call.getDouble("latitude"),
              let longitude = call.getDouble("longitude"),
              (-90.0...90.0).contains(latitude),
              (-180.0...180.0).contains(longitude) else {
            call.reject("Invalid weather coordinates.")
            return
        }
        guard #available(iOS 16.0, *) else {
            call.reject("Apple Weather requires iOS 16 or later.")
            return
        }

        let temperatureUnit = call.getString("temperatureUnit") ?? "celsius"
        let windUnit = call.getString("windUnit") ?? "kmh"
        let precipitationUnit = call.getString("precipitationUnit") ?? "mm"
        let requestedTimeZone = call.getString("timezone")

        Task {
            do {
                let result = try await makeForecast(
                    latitude: latitude,
                    longitude: longitude,
                    timezoneIdentifier: requestedTimeZone,
                    temperatureUnit: temperatureUnit,
                    windUnit: windUnit,
                    precipitationUnit: precipitationUnit
                )
                call.resolve(result)
            } catch {
                call.reject("Apple Weather is temporarily unavailable.", nil, error)
            }
        }
    }

    @available(iOS 16.0, *)
    private func makeForecast(
        latitude: Double,
        longitude: Double,
        timezoneIdentifier: String?,
        temperatureUnit: String,
        windUnit: String,
        precipitationUnit: String
    ) async throws -> [String: Any] {
        let service = WeatherService.shared
        let weather = try await service.weather(for: CLLocation(latitude: latitude, longitude: longitude))
        let weatherAttribution = try await service.attribution
        let timeZone = timezoneIdentifier.flatMap(TimeZone.init(identifier:)) ?? .current
        let dateTimeFormatter = localDateFormatter(timeZone: timeZone, format: "yyyy-MM-dd'T'HH:mm:ss")
        let dateFormatter = localDateFormatter(timeZone: timeZone, format: "yyyy-MM-dd")
        let current = weather.currentWeather
        let hourlyForecast = Array(weather.hourlyForecast.forecast.prefix(168))
        let dailyForecast = Array(weather.dailyForecast.forecast.prefix(7))
        let firstHour = hourlyForecast.first

        let hourly = hourlyForecast.map { hour -> [String: Any] in
            let precipitationAmount = lengthValue(hour.precipitationAmount, unit: precipitationUnit)
            let precipitationDescription = String(describing: hour.precipitation).lowercased()
            let split = splitPrecipitation(amount: precipitationAmount, description: precipitationDescription, condition: String(describing: hour.condition).lowercased())
            return [
                "time": dateTimeFormatter.string(from: hour.date),
                "temperature": temperatureValue(hour.temperature, unit: temperatureUnit),
                "apparentTemperature": temperatureValue(hour.apparentTemperature, unit: temperatureUnit),
                "humidity": percentage(hour.humidity),
                "precipitationProbability": percentage(hour.precipitationChance),
                "precipitation": precipitationAmount,
                "rain": split.rain,
                "showers": split.showers,
                "snowfall": split.snow,
                "weatherCode": weatherCode(for: hour.condition),
                "cloudCover": percentage(hour.cloudCover),
                "visibility": hour.visibility.converted(to: .meters).value,
                "windSpeed": speedValue(hour.wind.speed, unit: windUnit),
                "windDirection": hour.wind.direction.converted(to: .degrees).value,
                "windGusts": nullable(hour.wind.gust.map { speedValue($0, unit: windUnit) }),
                "uvIndex": Double(hour.uvIndex.value),
                "isDay": hour.isDaylight
            ]
        }

        let daily = dailyForecast.map { day -> [String: Any] in
            let rainAmount = lengthValue(day.rainfallAmount, unit: precipitationUnit)
            let snowAmount = lengthValue(day.snowfallAmount, unit: precipitationUnit)
            let sunrise = day.sun.sunrise
            let sunset = day.sun.sunset
            let daylight = daylightSeconds(sunrise: sunrise, sunset: sunset)
            return [
                "date": dateFormatter.string(from: day.date),
                "weatherCode": weatherCode(for: day.condition),
                "temperatureMax": temperatureValue(day.highTemperature, unit: temperatureUnit),
                "temperatureMin": temperatureValue(day.lowTemperature, unit: temperatureUnit),
                "apparentMax": temperatureValue(day.highTemperature, unit: temperatureUnit),
                "apparentMin": temperatureValue(day.lowTemperature, unit: temperatureUnit),
                "sunrise": sunrise.map(dateTimeFormatter.string(from:)) ?? "",
                "sunset": sunset.map(dateTimeFormatter.string(from:)) ?? "",
                "daylightDuration": daylight,
                "sunshineDuration": daylight,
                "uvIndexMax": Double(day.uvIndex.value),
                "precipitationSum": rainAmount + snowAmount,
                "rainSum": rainAmount,
                "showersSum": NSNull(),
                "snowfallSum": snowAmount,
                "precipitationProbabilityMax": percentage(day.precipitationChance),
                "windSpeedMax": speedValue(day.wind.speed, unit: windUnit),
                "windGustsMax": nullable(day.wind.gust.map { speedValue($0, unit: windUnit) }),
                "windDirectionDominant": day.wind.direction.converted(to: .degrees).value
            ]
        }

        let firstAmount = firstHour.map { lengthValue($0.precipitationAmount, unit: precipitationUnit) } ?? 0
        let firstDescription = firstHour.map { String(describing: $0.precipitation).lowercased() } ?? ""
        let firstCondition = firstHour.map { String(describing: $0.condition).lowercased() } ?? ""
        let currentSplit = splitPrecipitation(amount: firstAmount, description: firstDescription, condition: firstCondition)
        let currentPayload: [String: Any] = [
            "time": dateTimeFormatter.string(from: current.date),
            "temperature": temperatureValue(current.temperature, unit: temperatureUnit),
            "apparentTemperature": temperatureValue(current.apparentTemperature, unit: temperatureUnit),
            "humidity": percentage(current.humidity),
            "precipitationProbability": firstHour.map { percentage($0.precipitationChance) } ?? NSNull(),
            "precipitation": firstAmount,
            "rain": currentSplit.rain,
            "showers": currentSplit.showers,
            "snowfall": currentSplit.snow,
            "weatherCode": weatherCode(for: current.condition),
            "cloudCover": percentage(current.cloudCover),
            "visibility": current.visibility.converted(to: .meters).value,
            "windSpeed": speedValue(current.wind.speed, unit: windUnit),
            "windDirection": current.wind.direction.converted(to: .degrees).value,
            "windGusts": nullable(current.wind.gust.map { speedValue($0, unit: windUnit) }),
            "uvIndex": Double(current.uvIndex.value),
            "isDay": current.isDaylight
        ]

        return [
            "latitude": latitude,
            "longitude": longitude,
            "timezone": timeZone.identifier,
            "retrievedAt": dateTimeFormatter.string(from: current.metadata.date),
            "cached": false,
            "current": currentPayload,
            "hourly": hourly,
            "daily": daily,
            "attribution": [
                "serviceName": weatherAttribution.serviceName,
                "legalPageURL": weatherAttribution.legalPageURL.absoluteString,
                "markURL": weatherAttribution.combinedMarkDarkURL.absoluteString
            ]
        ]
    }

    private func localDateFormatter(timeZone: TimeZone, format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = format
        return formatter
    }

    private func percentage(_ value: Double) -> Double {
        min(100, max(0, value * 100))
    }

    private func temperatureValue(_ value: Measurement<UnitTemperature>, unit: String) -> Double {
        value.converted(to: unit == "fahrenheit" ? .fahrenheit : .celsius).value
    }

    private func speedValue(_ value: Measurement<UnitSpeed>, unit: String) -> Double {
        let target: UnitSpeed
        switch unit {
        case "mph": target = .milesPerHour
        case "ms": target = .metersPerSecond
        case "knots": target = .knots
        default: target = .kilometersPerHour
        }
        return value.converted(to: target).value
    }

    private func lengthValue(_ value: Measurement<UnitLength>, unit: String) -> Double {
        value.converted(to: unit == "inch" ? .inches : .millimeters).value
    }

    private func nullable(_ value: Double?) -> Any {
        value ?? NSNull()
    }

    private func daylightSeconds(sunrise: Date?, sunset: Date?) -> Double {
        guard let sunrise, let sunset, sunset >= sunrise else { return 0 }
        return sunset.timeIntervalSince(sunrise)
    }

    private func splitPrecipitation(amount: Double, description: String, condition: String) -> (rain: Any, showers: Any, snow: Any) {
        if description.contains("snow") || condition.contains("snow") || condition.contains("flurr") || condition.contains("blizzard") {
            return (NSNull(), NSNull(), amount)
        }
        if condition.contains("shower") || condition.contains("sunshowers") {
            return (NSNull(), amount, NSNull())
        }
        if amount > 0 || description.contains("rain") || condition.contains("rain") || condition.contains("drizzle") {
            return (amount, NSNull(), NSNull())
        }
        return (NSNull(), NSNull(), NSNull())
    }

    @available(iOS 16.0, *)
    private func weatherCode(for condition: WeatherCondition) -> Int {
        let value = String(describing: condition).lowercased()
        if value.contains("thunder") || value.contains("tropicalstorm") || value.contains("hurricane") { return value.contains("hail") ? 96 : 95 }
        if value.contains("freezingrain") || value.contains("freezingdrizzle") || value.contains("wintrymix") || value.contains("sleet") { return 66 }
        if value.contains("blizzard") || value.contains("heavysnow") { return 75 }
        if value.contains("snowshower") { return 85 }
        if value.contains("snow") || value.contains("flurr") || value.contains("blowingsnow") { return 71 }
        if value.contains("shower") || value.contains("sunshowers") { return 80 }
        if value.contains("heavyrain") { return 65 }
        if value.contains("rain") { return 61 }
        if value.contains("drizzle") { return 51 }
        if value.contains("fog") || value.contains("haze") || value.contains("smoke") { return 45 }
        if value.contains("mostlycloudy") || value == "cloudy" { return 3 }
        if value.contains("partlycloudy") { return 2 }
        if value.contains("mostlyclear") { return 1 }
        if value.contains("clear") { return 0 }
        return 3
    }
}

class SafarMateBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SafarMateStorePlugin())
        bridge?.registerPluginInstance(SafarMateWeatherPlugin())
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }
}
