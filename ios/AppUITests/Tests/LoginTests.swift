import XCTest

/// Logs in through the app's own /login route, then dumps whatever comes next.
final class LoginTests: XCTestCase {
    func testLoginAndDump() {
        let env = ProcessInfo.processInfo.environment
        let user = env["CWL_USER"] ?? ""
        let pass = env["CWL_PASS"] ?? ""
        print("ENV-USER-LEN \(user.count) ENV-PASS-LEN \(pass.count)")

        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let logout = app.buttons["Logout"].firstMatch
        if logout.waitForExistence(timeout: 25) {
            logout.tap()
            print("TAPPED-LOGOUT")
        } else {
            print("NO-LOGOUT-BUTTON")
        }

        // The logout handler awaits POST /api/logout before router.push("/login").
        var field = app.textFields.firstMatch
        for i in 1...12 where !field.exists {
            sleep(5)
            print("WAIT-\(i * 5)s fields=\(app.textFields.count) secure=\(app.secureTextFields.count)")
            field = app.textFields.firstMatch
        }

        print("TREE1-START")
        print(app.debugDescription)
        print("TREE1-END")

        guard field.exists else {
            print("NO-TEXTFIELD-FINAL")
            return
        }

        field.tap()
        field.typeText(user)
        let pw = app.secureTextFields.firstMatch
        if pw.exists {
            pw.tap()
            pw.typeText(pass)
        } else {
            print("NO-PASSWORD-FIELD")
        }
        print("TYPED-CREDS")

        var submitted = false
        for c in ["Sign in", "Log in", "Login", "Σύνδεση", "Continue", "Συνέχεια"] {
            if app.buttons[c].exists {
                app.buttons[c].tap()
                print("TAPPED-SUBMIT \(c)")
                submitted = true
                break
            }
        }
        if !submitted {
            // fall back to the keyboard's go key
            app.typeText("\n")
            print("SUBMIT-VIA-RETURN")
        }
        sleep(10)
        print("TREE2-START")
        print(app.debugDescription)
        print("TREE2-END")
    }
}
