import XCTest

/// Opens the new-log form by tapping the real "New" control and dumps the
/// form's accessibility tree, so the journey test can fill real fields.
final class FormDumpTests: XCTestCase {
    func testDumpNewLogForm() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let newLink = app.links["New"].firstMatch
        XCTAssertTrue(newLink.waitForExistence(timeout: 25), "New link not found on dashboard")
        newLink.tap()
        sleep(20)

        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
