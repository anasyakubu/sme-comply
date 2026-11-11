# Database

MongoDB via Mongoose. There are 13 collections. All documents have `createdAt` and `updatedAt` timestamps unless noted. Dates such as `dueDate` and `periodStart` are stored as **date-only values at 00:00 UTC**. The app interprets "today" in `APP_TIMEZONE` (Africa/Lagos).

## Relationships

```
User ─┬─< BusinessMember >─┬─ Business ─┬─< ComplianceTask >── RegulatoryRequirement >── RegulatoryAgency
      │                    │            ├─< FilingRecord  (taskId → ComplianceTask)
      │                    │            ├─< Document      (taskId?, filingId?)
      │                    │            └── ReminderSetting (one per business)
      ├─< RefreshToken
      ├─< Notification (businessId?, relatedTaskId?)
      └─< AuditLog     (businessId?)
LookupValue (standalone dropdown values)
```

## Collections

### users
| Field | Type | Notes |
|---|---|---|
| firstName, lastName | String | required |
| email | String | unique, lower-cased |
| phone | String | optional |
| passwordHash | String | bcrypt; `select: false` |
| role | enum | `OWNER`, `ACCOUNTANT`, `COMPLIANCE_OFFICER`, `ADMIN`, `SUPER_ADMIN` |
| isActive | Boolean | deactivated users cannot sign in, and their tokens stop working |
| emailVerified | Boolean | |
| emailVerificationTokenHash / Expires | String / Date | `select: false` |
| passwordResetTokenHash / Expires | String / Date | `select: false`, single use |
| lastLoginAt | Date | |

Indexes: unique `email`; text index on name and email. `toJSON` strips all hashes.

### refreshtokens
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → users | |
| tokenHash | String | SHA-256 of the cookie value |
| family | String | rotation chain id; reuse revokes the whole family |
| expiresAt | Date | TTL index removes expired tokens |
| revokedAt, replacedBy | Date, String | |
| userAgent, ip | String | |

### businesses
| Field | Type | Notes |
|---|---|---|
| businessName | String | required |
| legalName, registrationNumber (RC/BN), taxIdentificationNumber | String | |
| businessType, industry, state | String | required; drive applicability |
| city, address, phone, email, website | String | |
| dateOfIncorporation | Date | anchor for anniversary and one-time rules |
| employeeCount | Number | ≥ 0 |
| annualTurnover | Number | naira |
| businessStatus | enum | `ACTIVE`, `DORMANT`, `CLOSED` |
| flags | object | `cacRegistered`, `taxRegistered`, `vatRegistered`, `pensionRegistered`, `regulatedProducts`, `importsExports` |
| owner | ObjectId → users | |
| isDemo | Boolean | set by the seed script |

Indexes: text index on the names and RC number; `{ state, businessType }`.

### businessmembers
| Field | Type | Notes |
|---|---|---|
| user | ObjectId → users | empty while an invitation is pending |
| business | ObjectId → businesses | |
| role | enum | `OWNER`, `ACCOUNTANT`, `COMPLIANCE_OFFICER` |
| status | enum | `INVITED`, `ACTIVE`, `REMOVED` |
| invitedEmail, inviteTokenHash, inviteExpires, invitedBy, invitedAt, joinedAt | | |

Indexes: unique partial `{ user, business }` (only where a user is set); `{ business, invitedEmail }`. When someone registers with an invited email address, their pending invitations are linked automatically.

### regulatoryagencies
| Field | Type | Notes |
|---|---|---|
| name, acronym | String | `acronym` is unique |
| description, website, contactEmail, contactPhone | String | |
| level | enum | `FEDERAL`, `STATE`, `LOCAL` |
| active, isSampleData | Boolean | |
| createdBy, updatedBy | ObjectId → users | |

### regulatoryrequirements
| Field | Type | Notes |
|---|---|---|
| agencyId | ObjectId → regulatoryagencies | |
| name, code | String | `code` is unique, e.g. `NRS-VAT-MONTHLY` |
| description, category | String | category: Tax, Corporate, Pension, Employment, Licensing… |
| frequency | enum | `ONE_TIME`, `MONTHLY`, `QUARTERLY`, `BI_ANNUAL`, `ANNUAL`, `CUSTOM` |
| customIntervalMonths | Number | for `CUSTOM` |
| dueRule | Mixed | e.g. `{ type: 'DAY_OF_MONTH', day: 21, monthOffset: 1 }`; validated by the engine |
| applicabilityRules | Mixed | e.g. `{ match: 'ALL', conditions: [{ field: 'flags.vatRegistered', operator: 'IS_TRUE' }] }` |
| requiredDocuments | [String] | |
| penaltyInformation, officialWebsite, guidanceUrl | String | |
| active, effectiveFrom, effectiveUntil | Boolean, Date | generation respects the effective window |
| isSampleData | Boolean | shown as a "sample" label in the app |

### compliancetasks
| Field | Type | Notes |
|---|---|---|
| businessId, requirementId, agencyId | ObjectId | |
| title, category | String | copied from the requirement at generation |
| period, periodLabel | String | e.g. `2026-08` / `August 2026` |
| periodStart, periodEnd, dueDate | Date | |
| status | enum | `UPCOMING`, `PENDING`, `IN_PROGRESS`, `COMPLETED`, `OVERDUE`, `NOT_APPLICABLE` |
| priority | enum | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| assignedTo, completedBy | ObjectId → users | |
| completedAt | Date | |
| notes | [{ body, author, createdAt }] | |
| generatedAutomatically | Boolean | |

Indexes: **unique `{ businessId, requirementId, period }`** (duplicate guard); `{ businessId, status, dueDate }` for list and dashboard queries; text index on `title`.

### filingrecords
| Field | Type | Notes |
|---|---|---|
| taskId, businessId, filedBy | ObjectId | |
| filingDate | Date | |
| referenceNumber, submittedTo, notes | String | |
| status | enum | `DRAFT`, `SUBMITTED`, `ACCEPTED`, `REJECTED` |
| amountPaid | Number | naira |
| documents | [ObjectId → documents] | |

Indexes: `{ businessId, filingDate: -1 }`; text index on reference and notes.

### documents
| Field | Type | Notes |
|---|---|---|
| businessId, taskId?, filingId?, uploadedBy | ObjectId | |
| fileName, fileType, fileSize | String, String, Number | |
| cloudinaryUrl, publicId, storage | String | `storage` is `cloudinary` or `local` |
| documentType | enum | `TAX_RECEIPT`, `CERTIFICATE`, `FILING_ACKNOWLEDGEMENT`, `PAYMENT_EVIDENCE`, `REGISTRATION_DOCUMENT`, `LICENSE`, `CORRESPONDENCE`, `OTHER` |
| description | String | |
| uploadedAt | Date | |

### notifications
| Field | Type | Notes |
|---|---|---|
| userId, businessId?, relatedTaskId? | ObjectId | |
| type | enum | `REMINDER`, `DUE_TODAY`, `OVERDUE`, `TASK_COMPLETED`, `FILING_RECORDED`, `DOCUMENT_UPLOADED`, `INVITATION`, `SYSTEM` |
| title, message | String | |
| read, readAt | Boolean, Date | |
| reminderKey | String | e.g. `BEFORE_7`, `OVERDUE_14` |
| emailSent | Boolean | |

Indexes: **unique partial `{ userId, relatedTaskId, reminderKey }`** (each reminder sent once); `{ userId, createdAt: -1 }`.

### remindersettings
One per business: `daysBefore` [Number] (default `[30, 14, 7, 3, 1, 0]`), `remindWhenOverdue`, `emailEnabled`, `inAppEnabled`, `updatedBy`.

### auditlogs
`user`, `action` (e.g. `LOGIN`, `BUSINESS_UPDATED`, `FILING_RECORDED`), `entity`, `entityId`, `businessId`, `metadata`, `ip`, `userAgent`, `timestamp`.

### lookupvalues
`kind` (`BUSINESS_TYPE` or `INDUSTRY`), `value`, `active`, `sortOrder`. Unique `{ kind, value }`. Nigerian states are a fixed constant, not a lookup.
