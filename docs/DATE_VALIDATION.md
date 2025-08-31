# Date Validation Guide

## Overview

The Lodgify MCP server implements an intelligent feedback-based date validation system that helps LLMs self-correct date issues rather than automatically modifying user input. This system is designed to address common problems like LLM knowledge cutoffs, outdated training data, and context-specific date requirements.

## Philosophy

**Feedback Over Auto-Correction**: Rather than silently changing user input (which can introduce new errors), the system provides structured feedback that enables LLMs to make informed corrections themselves.

**Context-Aware Validation**: Different tools have different date validation requirements based on business logic and user expectations.

**Progressive Feedback**: The system provides actionable suggestions that guide users toward correct date formats and ranges.

## System Architecture

### Validation Modes

The system uses context-specific validation modes based on tool categories:

- **HARD**: Strict validation with error rejection for critical operations
- **SOFT**: Warning-based validation that allows processing while providing feedback
- **Context-Aware**: Adaptive validation that changes rules based on business logic

### Tool Categories

| Category | Mode | Purpose | Date Requirements |
|----------|------|---------|------------------|
| `AVAILABILITY` | SOFT | Availability checking | Warns on past dates, allows future dates |
| `BOOKING` | HARD | Reservation creation | Requires future dates for check-in |
| `RATE` | SOFT | Pricing information | Allows past/future dates with context |
| `QUOTE` | HARD | Quote generation | Validates against booking requirements |
| `HISTORICAL` | SOFT | Historical data | Allows past dates with validation |

## Feedback Object Schema

### Core Structure

```typescript
interface DateValidationFeedback {
  message: string                    // Human-readable description
  severity: FeedbackSeverity        // error | warning | info
  currentDate: string               // System date for context
  originalInput: string             // Exact user input
  detectedIssue: ValidationIssueCode // Specific issue type
  suggestions: string[]             // Actionable recommendations
  confirmationRequired: boolean     // Whether user should confirm
  feedbackStyle: FeedbackStyle      // minimal | detailed
  context?: ValidationContext       // Additional context
}
```

### Severity Levels

- **`error`**: Invalid input that prevents processing
- **`warning`**: Potentially incorrect input that allows processing
- **`info`**: Informational feedback for user awareness

### Issue Codes

- **`llm_cutoff_suspected`**: Date appears to be from LLM training cutoff
- **`past_date_warning`**: Past date provided where future expected
- **`invalid_format`**: Date format doesn't match required pattern
- **`invalid_range`**: Date outside acceptable range
- **`business_logic_violation`**: Date violates business rules

### Feedback Styles

- **`minimal`**: Concise feedback for simple corrections
- **`detailed`**: Comprehensive feedback with examples and context

## Validation Examples

### Example 1: LLM Cutoff Detection

**Input**: `"2024-09-15"` (when current year is 2025)

**Feedback**:
```json
{
  "message": "The date '2024-09-15' appears to be from a previous year (2024). Current year is 2025.",
  "severity": "warning",
  "currentDate": "2025-08-31T15:30:00Z",
  "originalInput": "2024-09-15",
  "detectedIssue": "llm_cutoff_suspected",
  "suggestions": [
    "If you meant this year, use: 2025-09-15",
    "If you meant the historical date 2024-09-15, please confirm",
    "Current date: 2025-08-31"
  ],
  "confirmationRequired": true,
  "feedbackStyle": "detailed"
}
```

### Example 2: Past Date Warning

**Input**: Check availability from `"2025-08-01"` (when today is 2025-08-31)

**Feedback**:
```json
{
  "message": "The date '2025-08-01' is 30 days in the past. Availability operations typically require future dates.",
  "severity": "warning",
  "currentDate": "2025-08-31T15:30:00Z",
  "originalInput": "2025-08-01",
  "detectedIssue": "past_date_warning",
  "suggestions": [
    "Did you mean a future date?",
    "Today's date: 2025-08-31",
    "Try using a date after today for availability checking"
  ],
  "confirmationRequired": false,
  "feedbackStyle": "minimal"
}
```

### Example 3: Invalid Date Range

**Input**: Check-in `"2025-09-20"`, Check-out `"2025-09-15"`

**Feedback**:
```json
{
  "message": "Invalid date range: end date '2025-09-15' is before start date '2025-09-20'.",
  "severity": "error",
  "currentDate": "2025-08-31T15:30:00Z",
  "originalInput": "2025-09-20 to 2025-09-15",
  "detectedIssue": "invalid_range",
  "suggestions": [
    "Ensure the end date is after the start date",
    "Check if the dates were entered in the correct order",
    "Example valid range: 2025-09-15 to 2025-09-20"
  ],
  "confirmationRequired": true,
  "feedbackStyle": "detailed"
}
```

### Example 4: Format Validation

**Input**: `"09/15/2025"` (expecting YYYY-MM-DD)

**Feedback**:
```json
{
  "message": "Date format should be YYYY-MM-DD. Received: '09/15/2025'",
  "severity": "error",
  "currentDate": "2025-08-31T15:30:00Z",
  "originalInput": "09/15/2025",
  "detectedIssue": "invalid_format",
  "suggestions": [
    "Use format: 2025-09-15",
    "Convert MM/DD/YYYY to YYYY-MM-DD format",
    "Ensure date uses hyphens, not slashes"
  ],
  "confirmationRequired": true,
  "feedbackStyle": "minimal"
}
```

## Integration Guide

### Tool Handler Integration

Tool handlers should consume feedback and include it in responses:

```typescript
// Validate date range
const validator = createValidator(DateToolCategory.AVAILABILITY);
const rangeValidation = validator.validateDateRange(startDate, endDate);

// Check for validation errors
if (!rangeValidation.start.isValid || !rangeValidation.end.isValid) {
    throw new Error(`Date validation failed: ${rangeValidation.start.error || rangeValidation.end.error}`);
}

// Prepare feedback info if available
let dateValidationInfo = null;
if (rangeValidation.start.feedback || rangeValidation.end.feedback) {
    dateValidationInfo = {
        dateValidation: {
            startDate: {
                original: rangeValidation.start.originalDate,
                validated: rangeValidation.start.validatedDate,
                feedback: rangeValidation.start.feedback
            },
            endDate: {
                original: rangeValidation.end.originalDate,
                validated: rangeValidation.end.validatedDate,
                feedback: rangeValidation.end.feedback
            },
            message: '⚠️ Date validation feedback available'
        }
    };
}

// Include feedback in API response
const finalResult = dateValidationInfo ? { ...result, ...dateValidationInfo } : result;
```

### Response Format

Tools return feedback in a consistent structure:

```json
{
  "data": {
    // Normal API response data
  },
  "dateValidation": {
    "startDate": {
      "original": "2024-09-15",
      "validated": "2024-09-15",
      "feedback": {
        "message": "Date appears to be from training cutoff year",
        "severity": "warning",
        "suggestions": ["Consider using 2025-09-15 if you meant this year"]
      }
    },
    "message": "⚠️ Date validation feedback available"
  }
}
```

### Error Handling

The system distinguishes between validation errors and processing warnings:

- **Validation Errors**: Hard failures that prevent processing
- **Validation Warnings**: Soft warnings that allow processing with feedback
- **Processing Errors**: API or business logic errors unrelated to validation

## Validation Context

### Tool-Specific Context

Different tools provide additional validation context:

**Availability Tools**:
```json
{
  "context": {
    "toolCategory": "AVAILABILITY",
    "businessLogic": "future_dates_preferred",
    "allowPastDates": true,
    "warningThreshold": 30
  }
}
```

**Booking Tools**:
```json
{
  "context": {
    "toolCategory": "BOOKING",
    "businessLogic": "future_dates_required",
    "allowPastDates": false,
    "minimumAdvanceNotice": 24
  }
}
```

### LLM Cutoff Detection

The system includes sophisticated detection for LLM training cutoffs:

- **Training Cutoff Year**: 2024 (detected pattern)
- **Current Year Gap**: Significant gap between detected year and system year
- **Confidence Scoring**: High confidence when multiple indicators align
- **Context Adaptation**: Different suggestions based on tool context

## Best Practices

### For LLM Consumption

1. **Read Feedback Messages**: Always check for `dateValidation` in responses
2. **Follow Suggestions**: Use provided suggestions for date corrections
3. **Confirm When Required**: Respond to `confirmationRequired: true` feedback
4. **Understand Context**: Consider tool-specific business logic
5. **Validate Corrections**: Ensure corrections make sense in context

### For Developers

1. **Consistent Integration**: Use the same feedback consumption pattern across tools
2. **Error vs Warning**: Distinguish between blocking errors and informational warnings
3. **User Experience**: Present feedback in user-friendly format
4. **Testing**: Include validation scenarios in test suites
5. **Documentation**: Keep validation rules documented and up-to-date

## Troubleshooting

### Common Issues

**Issue**: LLM keeps using 2024 dates despite feedback
- **Solution**: Include current date prominently in suggestions
- **Example**: "Current date: 2025-08-31" in every suggestion array

**Issue**: Business logic violations not caught
- **Solution**: Ensure tool category matches business requirements
- **Check**: Verify validation mode (HARD vs SOFT) is appropriate

**Issue**: Feedback not appearing in responses
- **Solution**: Check tool handler integration for feedback consumption
- **Debug**: Verify `dateValidationInfo` is merged with final result

### Debug Mode

Enable debug mode for detailed validation logging:

```bash
DEBUG_DATE_VALIDATION=1 bun start
```

This provides detailed logs of:
- Validation rule application
- Feedback generation process
- Context evaluation
- Issue detection logic

## Future Enhancements

### Planned Features

- **Localization**: Multi-language feedback messages
- **Custom Rules**: User-configurable validation rules
- **Machine Learning**: Adaptive validation based on usage patterns
- **Integration**: Enhanced MCP client integration for feedback handling

### Extensibility

The system is designed for extension:

- **New Tool Categories**: Easy addition of validation modes
- **Custom Validators**: Plugin-style validator registration
- **Feedback Formatters**: Customizable feedback presentation
- **Context Providers**: Additional validation context sources

---

*This guide provides comprehensive documentation for the feedback-based date validation system. For implementation details, see the source code in `src/mcp/utils/date-validator.ts`.*