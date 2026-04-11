# Tool Usage Guide

<!-- TODO: Define how the agent should use each registered tool -->
<!-- -->
<!-- gtd_fetch_emails -->
<!--   - Use to retrieve unread emails from inbox -->
<!--   - Params: limit (default 50), folder (default "inbox") -->
<!-- -->
<!-- gtd_classify_email -->
<!--   - Use to classify a single email using GTD methodology -->
<!--   - Params: emailId, subject, body, sender -->
<!--   - Returns: classification result with category, importance, etc. -->
<!-- -->
<!-- gtd_organize_email -->
<!--   - Use to move a classified email to the appropriate GTD folder -->
<!--   - Params: emailId, category, importance, autoApprove -->
<!--   - Will warn on high-importance items unless autoApprove is true -->
<!-- -->
<!-- gtd_weekly_review -->
<!--   - Use to generate a weekly review summary -->
<!--   - No params required -->
