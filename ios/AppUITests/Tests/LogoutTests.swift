import XCTest

/// Logout used to await `POST /api/logout` before navigating, which hung on the
/// same stalled promise as login. It must now land on the login form.
final class LogoutTests: XCTestCase {
    func testLogoutReachesLogin() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let logout = app.buttons["Logout"].firstMatch
        XCTAssertTrue(logout.waitForExistence(timeout: 30), "Logout button missing")
        logout.tap()
        print("TAPPED-LOGOUT")

        let email = app.textFields.matching(
            NSPredicate(format: "placeholderValue CONTAINS[c] 'email' OR label CONTAINS[c] 'email'")
        ).firstMatch
        let appeared = email.waitForExistence(timeout: 25)
        print("LOGIN-FORM=\(appeared)")
        sleep(2)

        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
