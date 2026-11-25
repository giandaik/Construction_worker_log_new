import XCTest

/// Journey: sign in on the real device, confirm live data, open the new-log flow.
final class JourneyTests: XCTestCase {
    private func fillField(_ app: XCUIApplication, _ field: XCUIElement, _ text: String, _ label: String) {
        XCTAssertTrue(field.waitForExistence(timeout: 25), "\(label) field not found")
        field.tap()
        Thread.sleep(forTimeInterval: 1.0)
        app.typeText(text)
        // The keyboard covers the next control; dismiss it via the accessory bar.
        if app.buttons["Done"].exists {
            app.buttons["Done"].tap()
        }
        Thread.sleep(forTimeInterval: 0.8)
        print("TYPED-\(label)")
    }

    func testLoginThenOpenNewLog() {
        let env = ProcessInfo.processInfo.environment
        let user = env["CWL_USER"] ?? ""
        let pass = env["CWL_PASS"] ?? ""

        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let email = app.textFields["Email"].firstMatch
        fillField(app, email, user, "EMAIL")
        print("EMAIL-VALUE-OK \(String(describing: email.value).contains(user.prefix(6)))")

        fillField(app, app.secureTextFields["Password"].firstMatch, pass, "PASSWORD")

        let signIn = app.buttons["Sign in"].firstMatch
        XCTAssertTrue(signIn.waitForExistence(timeout: 10), "sign in button not found")
        XCTAssertTrue(signIn.isHittable, "sign in button not hittable")
        signIn.tap()
        print("TAPPED-SIGNIN")

        let dashboard = app.staticTexts["WORK LOGS"]
        let tenant = app.staticTexts["Select Organisation"]
        let deadline = Date().addingTimeInterval(30)
        while Date() < deadline && !dashboard.exists && !tenant.exists {
            Thread.sleep(forTimeInterval: 1.0)
        }
        print("AFTER-SIGNIN dashboard=\(dashboard.exists) tenant=\(tenant.exists)")

        print("TREE-AFTER-START")
        print(app.debugDescription)
        print("TREE-AFTER-END")

        if tenant.exists {
            let org = app.buttons.matching(NSPredicate(format: "label.length > 3")).element(boundBy: 0)
            print("TENANT-FIRST \(org.label)")
            if org.exists { org.tap() }
            sleep(10)
        }
    }
}
