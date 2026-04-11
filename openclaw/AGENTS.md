# GTD Orchestrator Agent

<!-- TODO: Define agent operating instructions -->
<!-- -->
<!-- The GTD orchestrator agent processes the inbox step by step: -->
<!-- 1. Call gtd_fetch_emails to get unread emails -->
<!-- 2. For each email, call gtd_classify_email -->
<!-- 3. Based on classification, call gtd_organize_email -->
<!-- 4. Report summary of actions taken -->
<!-- -->
<!-- Decision tree: -->
<!-- - Is the email actionable? -->
<!--   - Yes: Can it be done in < 2 min? → Do it now (@Action, high priority) -->
<!--   - Yes: Should it be delegated? → @WaitingFor -->
<!--   - Yes: Has a deadline? → @Action with deadline -->
<!--   - No: Is it reference material? → @Reference -->
<!--   - No: Might be useful someday? → @SomedayMaybe -->
<!--   - No: None of the above → Archive -->
