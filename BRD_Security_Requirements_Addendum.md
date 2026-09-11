# BRD Addendum — Security Requirements

> **Purpose:** Response to reviewer comment — *"Security requirements are high level only. Authentication, Authorization, MFA, AD Integration, Privileged Access Management, Audit Logging and Access Recertification processes need to be defined."*
>
> **How to apply:** Replace the two-bullet **Security** subsection under **Non-Functional Requirements** with the expanded section below. Then add the one-line cross-references (bottom of this file) into the four other sections that touch security, so they point here instead of duplicating detail. The source BRD document is not modified by this file.

---

## Non-Functional Requirements → Security

IntelliSource enforces enterprise-grade security across authentication, authorization, and access governance. All controls are defined as target-state requirements and are aligned with the Azure Active Directory identity platform referenced in the Technical Architecture. The following seven areas define the security processes for the system.

### 1. Authentication

- All user authentication is federated through **Azure Active Directory (Azure AD)** using **OpenID Connect / SAML 2.0 single sign-on (SSO)**. No application-managed passwords are used for standard users.
- Session tokens are **short-lived JWTs** (for example, a 60-minute access token with sliding-expiry refresh). Tokens are signed and validated server-side, and logout invalidates the active session.
- Any break-glass or service account uses a defined password policy: minimum 14 characters, complexity enforced, 90-day rotation, no reuse of the last 12 passwords, and storage only as salted hashes.
- Accounts are locked after 5 consecutive failed attempts; all authentication events are logged (see §6).
- Idle-session timeout (for example, 30 minutes) and an absolute session lifetime are enforced.

### 2. Authorization

- Access is governed by **Role-Based Access Control (RBAC)** on a least-privilege, deny-by-default basis. Each application role (Procurement Manager, Finance Controller, Leadership, Vendor Management, Administrator, and others) maps to a documented **role-to-permission matrix**.
- **Data-level scoping** restricts each user to their permitted company codes, entities, and profit centres. Row-level filtering is enforced server-side, never in the UI alone.
- **Segregation of Duties (SoD):** conflicting permissions (for example, creating and approving the same purchase order, or posting an invoice and releasing its payment) cannot be assigned to a single role. SoD rules are defined and enforced at the point of role assignment.
- Authorization is validated on every API request server-side; role claims presented by the client are never trusted on their own.

### 3. Multi-Factor Authentication (MFA)

- MFA is **mandatory for all users** and enforced through **Azure AD Conditional Access**.
- Accepted factors are Microsoft Authenticator (push or TOTP) and FIDO2 security keys. SMS-based factors are discouraged.
- **Step-up authentication** is required for sensitive actions, including administrative functions, bulk data export, and any change to users or role assignments.
- Conditional Access policies apply additional checks by device compliance and network location where applicable.

### 4. Active Directory (AD) Integration

- **Azure AD is the sole identity provider.** The application maintains no standalone user directory.
- **Azure AD security groups map to application roles**; role membership is driven by group membership rather than manual in-application assignment.
- **Provisioning and de-provisioning are automated** via SCIM or AD group synchronization and tied to the organization's **Joiner–Mover–Leaver (JML)** process. Access is granted on joining, adjusted on role change, and revoked automatically within a defined SLA (for example, 24 hours) on exit.
- Integration service accounts (SAP, HRMS, APIs) are managed identities registered in Azure AD, not shared credentials.

### 5. Privileged Access Management (PAM)

- Privileged roles (Application Administrator, Database Administrator, Infrastructure) use **separate, dedicated administrative accounts** — never day-to-day user accounts.
- **Just-in-Time (JIT) elevation** with time-boxed access and an **approval workflow** (for example, Azure AD Privileged Identity Management) is used; standing privileged access is minimized.
- Privileged, service, and database credentials are **vaulted** (for example, Azure Key Vault). No secrets are stored in code, configuration files, or plaintext connection strings.
- **Privileged sessions are monitored and recorded**, with alerting on privileged actions.
- Break-glass emergency accounts are documented, alarmed, and reviewed after every use.

### 6. Audit Logging

- The system logs, at minimum: authentication events (success, failure, lockout, MFA), authorization denials, data access and create/update/delete operations on procurement records, administrative and configuration changes, role and permission changes, and data exports.
- Each log entry captures **who, what, when, source (IP/device), and before-and-after values** for changes.
- Logs are **immutable and tamper-evident**, and are stored separately from the application database.
- **Retention** is defined to policy and regulatory requirements (for example, a minimum of 1 year online with archival up to 7 years).
- Logs are forwarded to a central **SIEM** for correlation and alerting, and a periodic log-review process is defined.

### 7. Access Recertification

- **Periodic access reviews** are conducted (for example, quarterly for privileged access and half-yearly for standard access), in which role and data owners **attest** that each user's access remains required.
- Reviews are run as **campaigns** (for example, Azure AD Access Reviews). Access that is rejected or not attested is **automatically revoked** within a defined SLA.
- Recertification covers application roles, AD group membership, and privileged accounts.
- **Evidence of each review is retained** for internal and external audit, and reviews are tied to both the JML process and the SoD matrix.

---

## One-line cross-references to add in other sections

Add the italicized line to each section so it points here rather than repeating detail:

- **Functional Requirements → Access Control & User Management:**
  *Detailed security processes — authentication, authorization, MFA, AD integration, privileged access management, audit logging, and access recertification — are defined in Non-Functional Requirements → Security.*

- **Data Requirements → Data Security & Access Controls:**
  *Audit logging scope, immutability, retention, and SIEM integration are defined in Non-Functional Requirements → Security (§6, Audit Logging).*

- **User Roles and Permission:**
  *Role-to-permission mapping, Segregation of Duties, and periodic access recertification are defined in Non-Functional Requirements → Security (§2 and §7).*

- **Technical Architecture → Authentication & Access Control / Access & Security Layer:**
  *Azure AD federation, SSO, MFA, and privileged access management requirements are defined in Non-Functional Requirements → Security (§1, §3, §4, §5).*

---

## Phasing note (optional — for reviewer credibility)

The controls above are **target-state**. The current build implements RBAC and a basic audit trail; SSO, MFA, AD federation, PAM, and access recertification are not yet implemented. Recommend marking a **Phase 1 security baseline** (RBAC, audit logging, Azure AD SSO, MFA) versus **Phase 2** (JIT/PAM, automated recertification, SIEM), or adding a short *Current vs Target* line, to keep requirements consistent with delivered scope.
