import XCTest

/// Polls fast for the login form (it only appears briefly after Logout) and
/// types as soon as the field is present.
final class FastLoginTests: XCTestCase {
    func testSignInFast() {
        let env = ProcessInfo.processInfo.environment
        let user = env["CWL_USER"] ?? ""
        let pass = env["CWL_PASS"] ?? ""

        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let logout = app.buttons["Logout"].firstMatch
        if logout.waitForExistence(timeout: 25) { logout.tap() }
        print("TAPPED-LOGOUT")

        var seen = false
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            if app.textFields["Email"].exists {
                seen = true
                break
            }
            Thread.sleep(forTimeInterval: 0.3)
        }
        print("EMAIL-SEEN \(seen)")
        guard seen else {
            print("TREE-START")
            print(app.debugDescription)
            print("TREE-END")
            return
        }

        let email = app.textFields["Email"].firstMatch
        email.tap()
        app.typeText(user)
        print("EMAIL-TYPED nowExists=\(app.textFields["Email"].exists)")

        if app.buttons["Done"].exists { app.buttons["Done"].tap() }
        let pw = app.secureTextFields["Password"].firstMatch
        print("PW-EXISTS \(pw.exists) emailStillThere=\(email.exists)")
        if pw.exists {
            pw.tap()
            app.typeText(pass)
            print("PW-TYPED")
            if app.buttons["Done"].exists { app.buttons["Done"].tap() }
            let signIn = app.buttons["Sign in"].firstMatch
            print("SIGNIN-HITTABLE \(signIn.isHittable)")
            if signIn.exists { signIn.tap() }
            print("TAPPED-SIGNIN")
            sleep(12)
        }

        print("FINAL dashboard=\(app.staticTexts["WORK LOGS"].exists) email=\(app.textFields["Email"].exists)")
        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
