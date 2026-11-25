import XCTest

/// Tab-bar-driven walk of the native screens. Every navigation goes through the
/// tab bar or an in-app row, and each failure prints FAIL:<step> plus a compact
/// AX dump so the next run can be fixed without guessing coordinates.
final class ScreenWalk3Tests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")

    func shot(_ name: String, pause: UInt32 = 6) {
        sleep(1)
        print("READY:\(name)")
        sleep(pause)
    }

    func dump(_ where_: String) {
        print("DUMP:\(where_)")
        for el in app.links.allElementsBoundByIndex.prefix(25) {
            print("LINK \(el.label.replacingOccurrences(of: "\n", with: " | "))")
        }
        for el in app.buttons.allElementsBoundByIndex.prefix(15) {
            print("BUTTON \(el.label.replacingOccurrences(of: "\n", with: " | "))")
        }
    }

    func link(prefix: String, timeout: TimeInterval = 30) -> XCUIElement? {
        let el = app.links.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
        return el.waitForExistence(timeout: timeout) ? el : nil
    }

    func link(contains: String, timeout: TimeInterval = 20) -> XCUIElement? {
        let el = app.links.matching(NSPredicate(format: "label CONTAINS %@", contains)).firstMatch
        return el.waitForExistence(timeout: timeout) ? el : nil
    }


    /// First link that is page content rather than tab-bar chrome.
    func firstContentLink(timeout: TimeInterval = 20) -> XCUIElement? {
        let chrome: Set<String> = ["Home", "Logs", "New", "Sites", "Account", "New log", "Calendar"]
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            for el in app.links.allElementsBoundByIndex where el.exists && el.isHittable {
                let label = el.label
                if !chrome.contains(label) && !label.isEmpty {
                    return el
                }
            }
            usleep(500_000)
        } while Date() < deadline
        return nil
    }

    /// First button that is page content rather than chrome (picker rows are
    /// buttons, not links: they call onSelect instead of navigating).
    func firstContentButton(timeout: TimeInterval = 20) -> XCUIElement? {
        let chrome: Set<String> = ["Back", "Try again", "Go home", "Account", "New log", "Sign out"]
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            for el in app.buttons.allElementsBoundByIndex where el.exists && el.isHittable {
                let label = el.label
                if !chrome.contains(label) && !label.isEmpty {
                    return el
                }
            }
            usleep(500_000)
        } while Date() < deadline
        return nil
    }

    func testWalkScreens() {
        app.launch()

        // Sign out through the Account sheet so the login screen can be shot.
        let account = app.buttons["Account"].firstMatch
        if account.waitForExistence(timeout: 12) {
            account.tap()
            sleep(2)
            let signOut = app.buttons["Sign out"].firstMatch
            if signOut.waitForExistence(timeout: 5) { signOut.tap() }
            _ = app.buttons["Sign in"].waitForExistence(timeout: 15)
        }

        let email = app.textFields.matching(NSPredicate(format: "label CONTAINS[c] 'Email'")).firstMatch
        if email.waitForExistence(timeout: 20) {
            shot("01-login", pause: 4)
            let user = ProcessInfo.processInfo.environment["CWL_USER"] ?? ""
            let pass = ProcessInfo.processInfo.environment["CWL_PASS"] ?? ""
            email.tap()
            email.typeText(user)
            let password = app.secureTextFields.firstMatch
            password.tap()
            password.typeText(pass)
            app.buttons["Sign in"].firstMatch.tap()
        }

        // 02 — Home
        if let home = link(prefix: "Home") {
            home.tap()
        }
        sleep(5)
        if app.staticTexts["Today"].firstMatch.exists {
            shot("02-dashboard")
        } else {
            print("FAIL:dashboard")
            dump("dashboard")
        }

        // 03 — Logs list
        if let logs = link(prefix: "Logs") {
            logs.tap()
            sleep(4)
            shot("03-worklogs")

            // 04 — first log row (date column dd/mm/yyyy)
            let row = app.links.matching(NSPredicate(format: "label CONTAINS '/20'")).firstMatch
            if row.waitForExistence(timeout: 15) {
                row.tap()
                sleep(4)
                shot("04-worklog-detail")
                let back = app.links["Logs"].firstMatch
                if back.exists { back.tap() } else { app.swipeRight() }
                sleep(2)
            } else {
                print("FAIL:worklog-row")
                dump("worklogs")
            }
        } else {
            print("FAIL:logs-tab")
        }

        // 05/06 — New log: site picker then the form
        if let newTab = link(prefix: "New") {
            newTab.tap()
        } else {
            print("FAIL:new-tab")
        }
        if app.staticTexts["Which site today?"].firstMatch.waitForExistence(timeout: 25) {
            shot("05-new-site-picker")
            if let site = firstContentButton(timeout: 20) {
                print("PICK=\(site.label.replacingOccurrences(of: "\n", with: " | "))")
                site.tap()
                sleep(5)
                shot("06-new-log-form", pause: 8)
            } else {
                print("FAIL:site-row")
                dump("site-picker")
            }
        } else {
            print("FAIL:site-picker")
            dump("site-picker")
        }

        // 07 — Sites list
        if let sites = link(prefix: "Sites") {
            sites.tap()
        }
        sleep(4)
        if link(contains: "logs ·", timeout: 20) != nil {
            shot("07-projects")

            if let siteRow = link(contains: "logs ·", timeout: 10) {
                siteRow.tap()
                sleep(4)
                shot("08-project-detail")

                let cal = app.links["Calendar"].firstMatch.exists
                    ? app.links["Calendar"].firstMatch
                    : app.buttons["Calendar"].firstMatch
                if cal.waitForExistence(timeout: 12) {
                    cal.tap()
                    sleep(5)
                    shot("09-calendar")
                } else {
                    print("FAIL:calendar-control")
                    dump("project-detail")
                }
            } else {
                print("FAIL:project-row")
                dump("projects")
            }
        } else {
            print("FAIL:projects")
            dump("projects")
        }

        print("WALK-DONE")
    }
}
