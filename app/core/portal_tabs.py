"""The single list of tabs in the Account Admin / User portal.

The Super Admin picks, per account, which of the selectable tabs are active.
To add a new tab to the product: add one entry here (and its icon in
frontend/src/account-portal/portalTabs.js). It then appears automatically in
the Super Admin's selection list, off for every existing account until ticked.
"""

# audience: "all" = Account Admins and Users, "account_admin" = Account Admins only
# always_on: never selectable, always active for its audience
PORTAL_TABS = [
    {"key": "rules", "label": "Rules & Acts", "audience": "all", "always_on": False},
    {"key": "readiness", "label": "Readiness", "audience": "all", "always_on": False},
    {"key": "training", "label": "Training", "audience": "all", "always_on": False},
    {"key": "team_training", "label": "Team Training", "audience": "account_admin", "always_on": False},
    {"key": "sops", "label": "SOPs", "audience": "all", "always_on": False},
    {"key": "compliance", "label": "Compliance Score", "audience": "all", "always_on": False},
    {"key": "activity", "label": "Activity Tracker", "audience": "all", "always_on": False},
    {"key": "library", "label": "Document Library", "audience": "all", "always_on": False},
    {"key": "evidence", "label": "Evidences", "audience": "all", "always_on": False},
    {"key": "resources", "label": "Resources", "audience": "all", "always_on": False},
    {"key": "admin", "label": "Admin", "audience": "account_admin", "always_on": True},
]

SELECTABLE_TAB_KEYS = [t["key"] for t in PORTAL_TABS if not t["always_on"]]
