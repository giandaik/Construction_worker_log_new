import XCTest

/// Full journey on the device: landing page → Sign in → dashboard with live data
/// → New work log form. Dumps a tree at each stage.
final class RemoteJourneyTests: XCTestCase {
    private func fillField(_ app: XCUIApplication, _ field: XCUIElement, _ text: String, _ label: String) {
        XCTAssertTrue(field.waitForExistence(timeout: 30), "\(label) field not found")
        field.tap()
        Thread.sleep(forTimeInterval: 1.0)
        app.typeText(text)
        if app.buttons["Done"].exists { app.buttons["Done"].tap() }
        Thread.sleep(forTimeInterval: 0.8)
        print("TYPED-\(label)")
    }

    func testSignInThenOpenForm() {
        let env = ProcessInfo.processInfo.environment
        let user = env["CWL_USER"] ?? ""
        let pass = env["CWL_PASS"] ?? ""

        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let email = app.textFields["Email"].firstMatch
        if !email.waitForExistence(timeout: 20) {
            let signInLink = app.links["Sign in"].firstMatch
            let signInButton = app.buttons["Sign in"].firstMatch
            if signInLink.waitForExistence(timeout: 15) && signInLink.isHittable {
                signInLink.tap()
                print("TAPPED-SIGNIN-LINK")
            } else if signInButton.exists && signInButton.isHittable {
                signInButton.tap()
                print("TAPPED-SIGNIN-BUTTON")
            } else {
                print("NO-SIGNIN-ENTRY")
            }
        }

        XCTAssertTrue(email.waitForExistence(timeout: 30), "login form never appeared")
        print("LOGIN-FORM-VISIBLE")

        fillField(app, email, user, "EMAIL")
        fillField(app, app.secureTextFields["Password"].firstMatch, pass, "PASSWORD")

        let submit = app.buttons["Sign in"].firstMatch
        XCTAssertTrue(submit.isHittable, "submit not hittable")
        submit.tap()
        print("TAPPED-SUBMIT")

        let dashboard = app.staticTexts["WORK LOGS"]
        let tenant = app.staticTexts["Select Organisation"]
        let deadline = Date().addingTimeInterval(45)
        while Date() < deadline && !dashboard.exists && !tenant.exists {
            Thread.sleep(forTimeInterval: 1.0)
        }
        print("AFTER-SIGNIN dashboard=\(dashboard.exists) tenant=\(tenant.exists)")

        print("TREE-AFTER-START")
        print(app.debugDescription)
        print("TREE-AFTER-END")

        if tenant.exists {
            let org = app.buttons.matching(NSPredicate(format: "label.length > 3")).element(boundBy: 0)
            if org.exists { org.tap(); print("TAPPED-ORG \(org.label)"); sleep(10) }
        }

        let newLink = app.links["New"].firstMatch
        if newLink.waitForExistence(timeout: 20) && newLink.isHittable {
            newLink.tap()
            print("TAPPED-NEW")
            sleep(12)
            print("TREE-NEW-START")
            print(app.debugDescription)
            print("TREE-NEW-END")
        } else {
            print("NO-NEW-LINK")
        }
    }
}
