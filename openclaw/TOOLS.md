# Tool Usage Guide

## `gtd_fetch_emails`

Purpose:
- fetch unread inbox messages for processing

Input shape:
- `top?`
- `unreadOnly?`
- `since?`

Usage notes:
- use first in any processing run
- keep `top` bounded for controlled runs

## `gtd_classify_email`

Purpose:
- sanitize and classify one message into GTD category

Input shape:
- `messageId` (required)
- `subject?`
- `bodyPreview?`

Usage notes:
- do not call organize for a message without classification result
- reject invalid schema output

## `gtd_organize_email`

Purpose:
- ensure folder exists, move message, apply Outlook category

Input shape:
- `messageId` (required)
- `category` (required)
- `outlookCategory` (required)

Usage notes:
- respect idempotent skip behavior from processing state
- report move/category errors with context

## `gtd_sanitize_content`

Purpose:
- inspect raw content through sanitizer pipeline for troubleshooting/security review

Input shape:
- `content` (required)
- `maxLength?`

## `gtd_weekly_review`

Purpose:
- generate GTD weekly summary from classified items

Input shape:
- `items[]` with `id`, `category`, optional `importance`
