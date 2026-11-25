import XCTest

/// Walks the field-worker journey and pauses on each screen so the host can
/// grab a screenshot the moment `READY:<name>` appears in the log.
final class ScreenWalkTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")

    func shot(_ name: String, pause: UInt32 = 5) {
        sleep(1)
        print("READY:\(name)")
        sleep(pause)
    }

    func firstLink(prefix: String) -> XCUIElement {
        app.links.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    func testWalkAllScreens() {
        app.launch()

        // Already signed in? Sign out so the login screen can be photographed.
        let logout = app.buttons["Logout"].firstMatch
        if logout.waitForExistence(timeout: 12) {
            logout.tap()
            _ = app.buttons["Sign in"].waitForExistence(timeout: 15)
        }

        let email = app.textFields.matching(NSPredicate(format: "label CONTAINS[c] 'Email'")).firstMatch
        if email.waitForExistence(timeout: 20) {
            shot("01-login", pause: 3)

            let user = ProcessInfo.processInfo.environment["CWL_USER"] ?? ""
            let pass = ProcessInfo.processInfo.environment["CWL_PASS"] ?? ""
            email.tap()
            email.typeText(user)
            let password = app.secureTextFields.firstMatch
            password.tap()
            password.typeText(pass)
            app.buttons["Sign in"].firstMatch.tap()
        }

        // Dashboard
        let newLink = app.links["New"].firstMatch
        if newLink.waitForExistence(timeout: 40) {
            sleep(4)  // let the counter cards finish their fetch
            shot("02-dashboard")
        } else {
            print("FAIL:dashboard")
        }

        // Work log list
        let logsCard = firstLink(prefix: "WORK LOGS")
        if logsCard.exists {
            logsCard.tap()
            if app.staticTexts["New log"].waitForExistence(timeout: 25) { }
            sleep(2)
            shot("03-worklogs")

            // First row of the list
            let row = app.links.matching(NSPredicate(format: "label CONTAINS 'PEP' OR label CONTAINS '/2026'")).firstMatch
            if row.exists {
                row.tap()
                sleep(3)
                shot("04-worklog-detail")
                if firstLink(prefix: "Work Logs").exists { firstLink(prefix: "Work Logs").tap() } else { app.swipeRight() }
                sleep(2)
            } else { print("FAIL:worklog-row") }
        } else { print("FAIL:worklogs-card") }

        // Back to dashboard, then the new-log picker
        if firstLink(prefix: "Home").exists { firstLink(prefix: "Home").tap() } else { app.terminate(); app.launch() }
        _ = app.links["New"].waitForExistence(timeout: 30)

        app.links["New"].firstMatch.tap()
        let card = app.buttons.matching(NSPredicate(format: "label CONTAINS ' - '")).firstMatch
        if card.waitForExistence(timeout: 30) {
            shot("05-new-site-picker")
            print("CARD=\(card.label)")
            card.tap()
        } else { print("FAIL:site-picker") }

        if app.textViews.firstMatch.waitForExistence(timeout: 30) {
            sleep(2)
            shot("06-new-log-form", pause: 6)
        } else { print("FAIL:new-log-form") }

        // Projects list
        if firstLink(prefix: "Home").exists { firstLink(prefix: "Home").tap() } else { app.terminate(); app.launch() }
        _ = app.links["New"].waitForExistence(timeout: 30)
        let projectsCard = firstLink(prefix: "PROJECTS")
        if projectsCard.exists {
            projectsCard.tap()
            sleep(4)
            shot("07-projects")

            let projectRow = app.links.matching(NSPredicate(format: "label CONTAINS '24PEP'")).firstMatch
            if projectRow.exists {
                projectRow.tap()
                sleep(4)
                shot("08-project-detail")

                let cal = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'calendar'")).firstMatch
                let calLink = app.links.matching(NSPredicate(format: "label CONTAINS[c] 'calendar'")).firstMatch
                if cal.exists {
                    cal.tap()
                    sleep(4)
                    shot("09-calendar")
                } else if calLink.exists {
                    calLink.tap()
                    sleep(4)
                    shot("09-calendar")
                } else { print("FAIL:calendar-control") }
            } else { print("FAIL:project-row") }
        } else { print("FAIL:projects-card") }

        print("WALK-DONE")
    }
}
