import XCTest

/// Watches what the app does right after Logout, second by second.
final class LoginProbeTests: XCTestCase {
    func testLogoutThenWatch() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let logout = app.buttons["Logout"].firstMatch
        if logout.waitForExistence(timeout: 25) {
            logout.tap()
            print("TAPPED-LOGOUT")
        }

        for i in 1...10 {
            Thread.sleep(forTimeInterval: 2.0)
            let fields = app.textFields.count
            let secure = app.secureTextFields.count
            let signIn = app.buttons["Sign in"].exists
            let dash = app.staticTexts["WORK LOGS"].exists
            let email = app.textFields["Email"].exists
            print("T\(i * 2)s fields=\(fields) secure=\(secure) signIn=\(signIn) dashboard=\(dash) emailField=\(email)")
        }

        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
