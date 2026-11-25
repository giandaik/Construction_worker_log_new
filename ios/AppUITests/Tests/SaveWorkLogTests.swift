import XCTest

/// The whole journey: New → pick site → describe the work → submit.
/// The entry it writes is clearly labelled so it can be deleted afterwards.
final class SaveWorkLogTests: XCTestCase {
    func testSubmitWorkLog() {
        let app = XCUIApplication(bundleIdentifier: "com.constructionlog.app")
        app.launch()

        let newLink = app.links["New"].firstMatch
        XCTAssertTrue(newLink.waitForExistence(timeout: 30), "New link missing")
        newLink.tap()

        let firstCard = app.buttons.matching(NSPredicate(format: "label CONTAINS ' - '")).firstMatch
        XCTAssertTrue(firstCard.waitForExistence(timeout: 30), "no site card appeared")
        print("CARD=\(firstCard.label)")
        firstCard.tap()

        let description = app.textViews.firstMatch
        XCTAssertTrue(description.waitForExistence(timeout: 30), "work description field missing")
        description.tap()
        description.typeText("E2E verification entry - automated simulator check, safe to delete.")
        print("TYPED-DESCRIPTION")

        let submit = app.buttons["Submit Work Log"].firstMatch
        XCTAssertTrue(submit.waitForExistence(timeout: 20), "submit button missing")
        submit.tap()
        print("TAPPED-SUBMIT")

        // Poll for the outcome rather than sleeping blindly: a success toast, a
        // validation message, or a route change are all distinguishable.
        for i in 1...10 {
            sleep(3)
            let toast = app.staticTexts.matching(
                NSPredicate(format: "label CONTAINS[c] 'success' OR label CONTAINS[c] 'saved' OR label CONTAINS[c] 'created' OR label CONTAINS[c] 'error' OR label CONTAINS[c] 'required' OR label CONTAINS[c] 'failed'")
            )
            let toastLabels = toast.allElementsBoundByIndex.prefix(3).map { $0.label }
            print("T\(i * 3)s toasts=\(toastLabels)")
            if !toastLabels.isEmpty { break }
        }

        print("TREE-START")
        print(app.debugDescription)
        print("TREE-END")
    }
}
