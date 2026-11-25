import XCTest

/// Signs out via the Account sheet so the sign-in screen can be photographed,
/// then signs back in so the rest of the walk starts from a live session.
final class LoginShotTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")

    func testSignOutAndShootLogin() {
        app.launch()
        sleep(6)

        // The Account tab is a sheet trigger; AX sometimes exposes only its
        // text label, so fall back to the label and then to a coordinate tap.
        // AX exposes the sheet trigger as a plain container, not a Button.
        let accountOther = app.otherElements["Account"].firstMatch
        let accountButton = app.buttons["Account"].firstMatch
        if accountOther.waitForExistence(timeout: 12) {
            accountOther.tap()
        } else if accountButton.waitForExistence(timeout: 6) {
            accountButton.tap()
        } else {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.95)).tap()
        }
        sleep(2)

        let signOut = app.buttons["Sign out"].firstMatch
        if signOut.waitForExistence(timeout: 6) {
            signOut.tap()
        } else {
            print("FAIL:sign-out")
        }

        // Sign-in screen: first text field is the email.
        let email = app.textFields.firstMatch
        guard email.waitForExistence(timeout: 20) else {
            print("FAIL:login-screen")
            return
        }
        sleep(1)
        print("READY:01-login")
        sleep(6)

        let user = ProcessInfo.processInfo.environment["CWL_USER"] ?? ""
        let pass = ProcessInfo.processInfo.environment["CWL_PASS"] ?? ""
        email.tap()
        email.typeText(user)
        let password = app.secureTextFields.firstMatch
        password.tap()
        password.typeText(pass)
        let submit = app.buttons["Sign in"].firstMatch
        if submit.exists { submit.tap() } else { app.keyboards.buttons["Go"].firstMatch.tap() }

        let home = app.links["Home"].firstMatch
        print(home.waitForExistence(timeout: 45) ? "SIGNED-IN" : "FAIL:sign-in")
        print("WALK-DONE")
    }
}
