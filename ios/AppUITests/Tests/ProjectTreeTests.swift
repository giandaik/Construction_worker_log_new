import XCTest

/// Dumps the project detail tree so the calendar affordance can be identified
/// from the accessibility tree instead of guessed at.
final class ProjectTreeTests: XCTestCase {
    func testDumpProject() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()
        let projectsCard = app.links.matching(NSPredicate(format: "label BEGINSWITH 'PROJECTS'")).firstMatch
        XCTAssertTrue(projectsCard.waitForExistence(timeout: 40))
        sleep(2)
        projectsCard.tap()
        let row = app.links.matching(NSPredicate(format: "label CONTAINS '24PEP'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30))
        row.tap()
        sleep(5)
        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
