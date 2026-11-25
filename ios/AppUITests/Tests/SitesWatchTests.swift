import XCTest

/// Sits on the new-log page and watches whether the site list ever loads.
final class SitesWatchTests: XCTestCase {
    func testWatchSites() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let newLink = app.links["New"].firstMatch
        XCTAssertTrue(newLink.waitForExistence(timeout: 30), "New link missing")
        newLink.tap()
        print("TAPPED-NEW")

        for i in 1...8 {
            sleep(5)
            let loading = app.staticTexts["Loading sites…"].exists
            let errorText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'error' OR label CONTAINS[c] 'failed' OR label CONTAINS[c] 'No sites'")).count
            let buttons = app.buttons.count
            print("T\(i * 5)s loading=\(loading) errors=\(errorText) buttons=\(buttons)")
            if !loading && buttons > 0 { break }
        }

        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
