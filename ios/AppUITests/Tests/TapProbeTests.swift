import XCTest

/// Focused probe: does tapping a native list row navigate? Prints the visible
/// text before and after the tap so a silent no-op is obvious.
final class TapProbeTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")

    func texts(_ tag: String) {
        print("TEXTS:\(tag)")
        for t in app.staticTexts.allElementsBoundByIndex.prefix(30) {
            print("  T \(t.label.replacingOccurrences(of: "\n", with: " | "))")
        }
    }

    func testTapLogRow() {
        app.launch()
        sleep(6)

        let logs = app.links.matching(NSPredicate(format: "label BEGINSWITH 'Logs'")).firstMatch
        if logs.waitForExistence(timeout: 25) { logs.tap() }
        sleep(5)
        texts("list")

        let row = app.links.matching(NSPredicate(format: "label CONTAINS '/20'")).firstMatch
        print("ROW exists=\(row.exists) frame=\(row.frame) hittable=\(row.exists ? row.isHittable : false)")
        guard row.exists else { print("FAIL:no-row"); return }

        row.tap()
        sleep(6)
        texts("after-tap")
        sleep(1)
        print("READY:probe-after-tap")
        sleep(4)

        // Second attempt: tap by coordinate inside the row.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).withOffset(CGVector(dx: 0, dy: 0)).tap()
        sleep(5)
        texts("after-coord-tap")
        print("WALK-DONE")
    }
}
