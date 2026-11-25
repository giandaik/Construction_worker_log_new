import XCTest

/// Taps "New", picks the first site, and dumps the resulting form so the
/// field names for the save test come from the accessibility tree, not a guess.
final class PickProjectTests: XCTestCase {
    func testPickFirstProject() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let newLink = app.links["New"].firstMatch
        XCTAssertTrue(newLink.waitForExistence(timeout: 30), "New link missing")
        newLink.tap()

        // Project cards render as buttons labelled "<code> - <name> <status>".
        let firstCard = app.buttons.matching(NSPredicate(format: "label CONTAINS ' - '")).firstMatch
        XCTAssertTrue(firstCard.waitForExistence(timeout: 30), "no site card appeared")
        print("CARD=\(firstCard.label)")
        firstCard.tap()
        print("TAPPED-CARD")

        sleep(6)
        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
