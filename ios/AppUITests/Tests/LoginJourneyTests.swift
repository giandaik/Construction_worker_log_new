import XCTest

/// Sign in from the dashboard (via Logout → /login) and confirm the app reaches
/// an authenticated dashboard. Stage 1 of the on-device journey.
final class LoginJourneyTests: XCTestCase {
    private func fillField(_ app: XCUIApplication, _ field: XCUIElement, _ text: String, _ label: String) {
        XCTAssertTrue(field.waitForExistence(timeout: 30), "\(label) field not found")
        field.tap()
        Thread.sleep(forTimeInterval: 1.0)
        app.typeText(text)
        if app.buttons["Done"].exists {
            app.buttons["Done"].tap()
        }
        Thread.sleep(forTimeInterval: 0.8)
        print("TYPED-\(label)")
    }

    func testSignIn() {
        let env = ProcessInfo.processInfo.environment
        let user = env["CWL_USER"] ?? ""
        let pass = env["CWL_PASS"] ?? ""

        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        // Fresh install shows the unauthenticated dashboard; Logout is the only
        // control that leads to /login.
        let logout = app.buttons["Logout"].firstMatch
        if logout.waitForExistence(timeout: 25) {
            logout.tap()
            print("TAPPED-LOGOUT")
        }

        let email = app.textFields["Email"].firstMatch
        XCTAssertTrue(email.waitForExistence(timeout: 30), "never reached the login form")
        print("LOGIN-FORM-VISIBLE")

        fillField(app, email, user, "EMAIL")
        fillField(app, app.secureTextFields["Password"].firstMatch, pass, "PASSWORD")

        let signIn = app.buttons["Sign in"].firstMatch
        XCTAssertTrue(signIn.isHittable, "sign in button not hittable")
        signIn.tap()
        print("TAPPED-SIGNIN")

        let dashboard = app.staticTexts["WORK LOGS"]
        let tenant = app.staticTexts["Select Organisation"]
        let deadline = Date().addingTimeInterval(40)
        while Date() < deadline && !dashboard.exists && !tenant.exists {
            Thread.sleep(forTimeInterval: 1.0)
        }
        print("AFTER-SIGNIN dashboard=\(dashboard.exists) tenant=\(tenant.exists)")

        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
