import XCTest

/// Opens the new-work-log flow from an authenticated dashboard and dumps it.
final class NewLogTests: XCTestCase {
    func testOpenNewLog() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let newLink = app.links["New"].firstMatch
        XCTAssertTrue(newLink.waitForExistence(timeout: 30), "New link missing")
        newLink.tap()
        print("TAPPED-NEW")
        sleep(10)

        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
