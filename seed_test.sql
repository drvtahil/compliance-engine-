-- 1. Insert Master Acts & Lists
INSERT INTO acts (act_code, act_name, description) 
VALUES ('DPDPA_2023', 'Digital Personal Data Protection Act 2023', 'India Data Privacy Law');

INSERT INTO master_industry_processes (process_name, description) 
VALUES ('Customer Onboarding', 'Verification and data consent collection during signup');

INSERT INTO master_tasks (task_name, category) 
VALUES ('Update Privacy Policy Notice', 'Documentation');

INSERT INTO master_sub_domains (sub_domain_name) 
VALUES ('Consent Management');

-- 2. Insert Test Account (ID will automatically be 'account-0001')
INSERT INTO accounts (account_name, location, ceo_founder_name, phone, contact_person_name, contact_phone)
VALUES ('Alpha HealthTech Pvt Ltd', 'Hyderabad', 'Jane Doe', '+91-9876543210', 'John Smith', '+91-9876543211');

-- 3. Map Act to Account
INSERT INTO account_enrolled_acts (account_id, act_id)
VALUES ('account-0001', 1);

-- 4. Create Account Admin (ID will automatically be 'admin-0001')
INSERT INTO account_admins (account_id, name, phone, email, password_hash, visible_password_encrypted)
VALUES ('account-0001', 'Admin User', '+91-9876543211', 'admin@alphahealth.com', 'hashed_pw_here', 'TempPass@123');

-- 5. Insert Nested Rules Structure
INSERT INTO rule_chapters (act_id, chapter_number, title)
VALUES (1, 'Chapter II', 'Obligations of Data Fiduciary');

INSERT INTO rules (chapter_id, rule_number, rule_title)
VALUES (1, 'Rule 4', 'Notice & Consent Mechanisms');

INSERT INTO rule_sections (rule_id, section_number, title, section_explanation, examples)
VALUES (1, 'Section 5(1)', 'Notice Requirement', 'Data fiduciary must give notice before seeking consent.', 'Display bilingual consent banner');

INSERT INTO rule_sub_sections (section_id, sub_section_number, title, content)
VALUES (1, 'Sub-sec (a)', 'Itemized description', 'Notice must specify personal data sought.');

INSERT INTO rule_paragraphs (sub_section_id, paragraph_number, content)
VALUES (1, 'Para 1', 'The notice shall be provided in clear and plain language.');

INSERT INTO rule_sub_paragraphs (paragraph_id, sub_paragraph_number, content)
VALUES (1, 'Sub-para (i)', 'Must be available in 22 scheduled languages.');