import XCTest

/// The screens the first walk missed: the new-log flow needs a fresh launch to
/// reach a settled dashboard, and the calendar control sits below the fold.
final class ScreenWalk2Tests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")

    func shot(_ name: String, pause: UInt32 = 5) {
        sleep(1)
        print("READY:\(name)")
        sleep(pause)
    }

    func test1_newLogScreens() {
        app.launch()
        let newLink = app.links["New"].firstMatch
        XCTAssertTrue(newLink.waitForExistence(timeout: 40), "dashboard did not load")
        sleep(3)
        newLink.tap()

        let card = app.buttons.matching(NSPredicate(format: "label CONTAINS ' - '")).firstMatch
        if card.waitForExistence(timeout: 40) {
            shot("05-new-site-picker")
            card.tap()
            if app.textViews.firstMatch.waitForExistence(timeout: 30) {
                sleep(2)
                shot("06-new-log-form", pause: 6)
            } else { print("FAIL:new-log-form") }
        } else { print("FAIL:site-picker") }
    }

    func test2_calendar() {
        app.terminate()
        app.launch()
        let projectsCard = app.links.matching(NSPredicate(format: "label BEGINSWITH 'PROJECTS'")).firstMatch
        XCTAssertTrue(projectsCard.waitForExistence(timeout: 40), "dashboard did not load")
        sleep(2)
        projectsCard.tap()

        let row = app.links.matching(NSPredicate(format: "label CONTAINS '24PEP'")).firstMatch
        if row.waitForExistence(timeout: 30) {
            row.tap()
            sleep(5)
            // The action row sits under the project header; scroll it into view.
            for _ in 1...3 {
                let cal = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'calendar'")).firstMatch
                if cal.exists && cal.isHittable { break }
                app.swipeUp()
                usleep(600_000)
            }
            // The control is a <Link> wrapping a <Button>, so AX reports a link.
            let cal = app.links["Calendar"].firstMatch
            if cal.waitForExistence(timeout: 15) {
                cal.tap()
                sleep(5)
                shot("09-calendar")
            } else { print("FAIL:calendar-control") }
        } else { print("FAIL:project-row") }
    }
}
