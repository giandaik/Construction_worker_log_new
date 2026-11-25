import XCTest

/// Dumps the accessibility tree of the running app so the journey test can
/// target real labels instead of guessed coordinates.
final class TreeDumpTests: XCTestCase {
    func testDumpTree() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()
        sleep(8)
        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")

        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "launch"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
