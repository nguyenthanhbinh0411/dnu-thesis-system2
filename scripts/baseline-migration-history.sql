-- =============================================
-- Oracle EF Core Migration History Baseline Script
-- Graduation Thesis Management System
-- =============================================
--
-- PURPOSE:
-- This script baselines the __EFMigrationsHistory table when the database schema
-- already exists but EF Core doesn't know about it.
--
-- SAFETY:
-- - Idempotent: Safe to run multiple times
-- - Does NOT modify any data tables
-- - Only inserts migration records if they don't exist
--
-- PREREQUISITES:
-- 1. Database schema (tables) must already exist
-- 2. Run this BEFORE deploying with RUN_DB_MIGRATIONS=false
--
-- VERIFY SCHEMA EXISTS FIRST:
-- SELECT table_name FROM user_tables WHERE UPPER(table_name) IN ('COHORTS', 'USERS', 'DEFENSETERMS');

-- =============================================
-- 1. Create __EFMigrationsHistory table if not exists
-- =============================================
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM user_tables
    WHERE UPPER(table_name) = '__EFMIGRATIONSHistory';

    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE "__EFMigrationsHistory" (
                "MigrationId" NVARCHAR2(150) NOT NULL,
                "ProductVersion" NVARCHAR2(32) NOT NULL,
                CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
            )';
        DBMS_OUTPUT.PUT_LINE('Created table __EFMigrationsHistory');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Table __EFMigrationsHistory already exists');
    END IF;
END;
/

-- =============================================
-- 2. Check existing migrations
-- =============================================
SELECT 'Current migration history:' AS status FROM dual;
SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId";

-- =============================================
-- 3. Insert migration history (Idempotent)
-- =============================================
DECLARE
    v_count NUMBER;
BEGIN
    -- 20260516144500_InitialCreate
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260516144500_InitialCreate';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260516144500_InitialCreate', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260516144500_InitialCreate');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260516144500_InitialCreate');
    END IF;

    -- 20260522090910_AddMilestoneFailureTracking
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260522090910_AddMilestoneFailureTracking';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260522090910_AddMilestoneFailureTracking', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260522090910_AddMilestoneFailureTracking');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260522090910_AddMilestoneFailureTracking');
    END IF;

    -- 20260522101326_AddAllowLateSubmitToProgressMilestone
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260522101326_AddAllowLateSubmitToProgressMilestone';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260522101326_AddAllowLateSubmitToProgressMilestone', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260522101326_AddAllowLateSubmitToProgressMilestone');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260522101326_AddAllowLateSubmitToProgressMilestone');
    END IF;

    -- 20260523025945_AddDefenseTermIdToProfiles
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260523025945_AddDefenseTermIdToProfiles';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260523025945_AddDefenseTermIdToProfiles', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260523025945_AddDefenseTermIdToProfiles');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260523025945_AddDefenseTermIdToProfiles');
    END IF;

    -- 20260523075342_AddDefenseTermIdToRequestsAndFiles
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260523075342_AddDefenseTermIdToRequestsAndFiles';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260523075342_AddDefenseTermIdToRequestsAndFiles', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260523075342_AddDefenseTermIdToRequestsAndFiles');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260523075342_AddDefenseTermIdToRequestsAndFiles');
    END IF;

    -- 20260524122513_AddLecturerToCatalogTopic
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260524122513_AddLecturerToCatalogTopic';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260524122513_AddLecturerToCatalogTopic', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260524122513_AddLecturerToCatalogTopic');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260524122513_AddLecturerToCatalogTopic');
    END IF;

    -- 20260526164915_MakeUserIdNullableOnProfiles
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260526164915_MakeUserIdNullableOnProfiles';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260526164915_MakeUserIdNullableOnProfiles', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260526164915_MakeUserIdNullableOnProfiles');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260526164915_MakeUserIdNullableOnProfiles');
    END IF;

    -- 20260526193600_AddDefenseTermIdToCatalogTopics
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260526193600_AddDefenseTermIdToCatalogTopics';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260526193600_AddDefenseTermIdToCatalogTopics', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260526193600_AddDefenseTermIdToCatalogTopics');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260526193600_AddDefenseTermIdToCatalogTopics');
    END IF;

    -- 20260529095631_AddDefenseTermIdToMilestoneTemplate
    SELECT COUNT(*) INTO v_count FROM "__EFMigrationsHistory"
    WHERE "MigrationId" = '20260529095631_AddDefenseTermIdToMilestoneTemplate';
    IF v_count = 0 THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260529095631_AddDefenseTermIdToMilestoneTemplate', '8.0.0');
        DBMS_OUTPUT.PUT_LINE('Inserted: 20260529095631_AddDefenseTermIdToMilestoneTemplate');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Already exists: 20260529095631_AddDefenseTermIdToMilestoneTemplate');
    END IF;

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Migration history baseline completed!');
END;
/

-- =============================================
-- 4. Verify final state
-- =============================================
SELECT 'Final migration history:' AS status FROM dual;
SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId";

-- =============================================
-- 5. Verify schema tables exist
-- =============================================
SELECT 'Tables that should exist:' AS status FROM dual;
SELECT table_name, num_rows
FROM user_tables
WHERE table_name IN (
    'COHORTS', 'USERS', 'DEFENSETERMS', 'PROFILES', 'CATALOGTOPICS',
    'MILESTONETEMPLATES', 'MILESTONEASSIGNMENTS', 'DEFENSESCHEDULES',
    '__EFMigrationsHistory'
)
ORDER BY table_name;
