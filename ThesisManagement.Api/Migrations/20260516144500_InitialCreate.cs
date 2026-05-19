using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ThesisManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "COHORTS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    COHORT_CODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    COHORT_NAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: false),
                    START_YEAR = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    END_YEAR = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    STATUS = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 1),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    UPDATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_COHORTS", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "COMMITTEECODERESERVATIONS",
                columns: table => new
                {
                    COMMITTEECODERESERVATIONID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    PERIODID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    YEAR = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SEQUENCE = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    COMMITTEECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    STATUS = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    REQUESTKEY = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: true),
                    RESERVEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    EXPIRESAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    COMMITTEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_COMMITTEECODERESERVATIONS", x => x.COMMITTEECODERESERVATIONID);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSEGROUPS",
                columns: table => new
                {
                    DEFENSEGROUPID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    TERMID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SLOTID = table.Column<string>(type: "NVARCHAR2(80)", maxLength: 80, nullable: false),
                    STUDENTCODESJSON = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSEGROUPS", x => x.DEFENSEGROUPID);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSETERMS",
                columns: table => new
                {
                    DEFENSETERMID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    TERMCODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    NAME = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ACADEMICYEAR = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    SEMESTER = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    STARTDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    ENDDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    CONFIGJSON = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    STATUS = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false, defaultValue: "Draft"),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSETERMS", x => x.DEFENSETERMID);
                });

            migrationBuilder.CreateTable(
                name: "DEPARTMENTS",
                columns: table => new
                {
                    DEPARTMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    DEPARTMENTCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    NAME = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEPARTMENTS", x => x.DEPARTMENTID);
                    table.UniqueConstraint("AK_DEPARTMENTS_DEPARTMENTCODE", x => x.DEPARTMENTCODE);
                });

            migrationBuilder.CreateTable(
                name: "EXPORTFILES",
                columns: table => new
                {
                    EXPORTFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    FILECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    TERMID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    STATUS = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false, defaultValue: "Running"),
                    FILEURL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("EXPORTFILEID", x => x.EXPORTFILEID);
                });

            migrationBuilder.CreateTable(
                name: "IDEMPOTENCY_RECORDS",
                columns: table => new
                {
                    IDEMPOTENCY_RECORD_ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ACTION = table.Column<string>(type: "NVARCHAR2(80)", maxLength: 80, nullable: false),
                    PERIOD_ID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    REQUEST_KEY = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    REQUEST_HASH = table.Column<string>(type: "NVARCHAR2(128)", maxLength: 128, nullable: false),
                    RESPONSE_PAYLOAD = table.Column<string>(type: "CLOB", nullable: true),
                    RESPONSE_STATUS_CODE = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    RESPONSE_SUCCESS = table.Column<int>(type: "NUMBER(1)", nullable: true),
                    RECORD_STATUS = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    EXPIRES_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    COMPLETED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IDEMPOTENCY_RECORDS", x => x.IDEMPOTENCY_RECORD_ID);
                });

            migrationBuilder.CreateTable(
                name: "LECTURERDASHBOARDVIEW",
                columns: table => new
                {
                    LECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LECTURERCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    FULLNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DEPARTMENTCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DEGREE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    GUIDEQUOTA = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    DEFENSEQUOTA = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    EMAIL = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    PHONENUMBER = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    PROFILEIMAGE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CURRENTGUIDINGCOUNT = table.Column<int>(type: "NUMBER(10)", nullable: false)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "MILESTONETEMPLATES",
                columns: table => new
                {
                    MILESTONETEMPLATEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    MILESTONETEMPLATECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    NAME = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    Ordinal = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    DEADLINE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MILESTONETEMPLATES", x => x.MILESTONETEMPLATEID);
                    table.UniqueConstraint("AK_MILESTONETEMPLATES_MILESTONETEMPLATECODE", x => x.MILESTONETEMPLATECODE);
                });

            migrationBuilder.CreateTable(
                name: "NOTIFICATION_OUTBOX",
                columns: table => new
                {
                    OUTBOX_ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    EVENT_TYPE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    PAYLOAD_JSON = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    OUTBOX_STATUS = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false, defaultValue: "PENDING"),
                    RETRY_COUNT = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    NEXT_RETRY_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    LAST_ERROR = table.Column<string>(type: "NVARCHAR2(1000)", maxLength: 1000, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    PROCESSED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NOTIFICATION_OUTBOX", x => x.OUTBOX_ID);
                });

            migrationBuilder.CreateTable(
                name: "NOTIFICATIONS",
                columns: table => new
                {
                    NOTIFICATION_ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    NOTIFICATION_CODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: false),
                    NOTIF_CHANNEL = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    NOTIF_CATEGORY = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    NOTIF_TITLE = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: false),
                    NOTIF_BODY = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    NOTIF_PRIORITY = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    ACTION_TYPE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    ACTION_URL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    IMAGE_URL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    RELATED_ENTITY_NAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    RELATED_ENTITY_CODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    RELATED_ENTITY_ID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    TRIGGERED_BY_USER_ID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    TRIGGERED_BY_USER_CODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    IS_GLOBAL = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    SCHEDULE_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    EXPIRES_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    UPDATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NOTIFICATIONS", x => x.NOTIFICATION_ID);
                });

            migrationBuilder.CreateTable(
                name: "ROOMS",
                columns: table => new
                {
                    ROOM_ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ROOM_CODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    ROOM_STATUS = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LAST_UPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ROOMS", x => x.ROOM_ID);
                });

            migrationBuilder.CreateTable(
                name: "SYNCAUDITLOGS",
                columns: table => new
                {
                    SYNCAUDITLOGID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    TIMESTAMP = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    ACTION = table.Column<string>(type: "NVARCHAR2(150)", maxLength: 150, nullable: false),
                    RESULT = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    RECORDS = table.Column<string>(type: "NCLOB", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SYNCAUDITLOGS", x => x.SYNCAUDITLOGID);
                });

            migrationBuilder.CreateTable(
                name: "TAGS",
                columns: table => new
                {
                    TAGID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    TAGCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    TAGNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TAGS", x => x.TAGID);
                });

            migrationBuilder.CreateTable(
                name: "TOPIC_WORKFLOW_AUDITS",
                columns: table => new
                {
                    AUDIT_ID = table.Column<long>(type: "NUMBER(19)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    AUDIT_CODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    MODULE_NAME = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    WORKFLOW_NAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: false),
                    ACTION_TYPE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    DECISION_ACTION = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    TOPIC_ID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    TOPIC_CODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    ENTITY_NAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    ENTITY_ID = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    ENTITY_CODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    OLD_STATUS = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    NEW_STATUS = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    STATUS_CODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    RESUBMIT_COUNT_BEFORE = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    RESUBMIT_COUNT_AFTER = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    COMMENT_TEXT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ERROR_MESSAGE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    IS_SUCCESS = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 1),
                    REQUEST_PAYLOAD = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    RESPONSE_PAYLOAD = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CHANGED_FIELDS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    TAGS_BEFORE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    TAGS_AFTER = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    MILESTONE_BEFORE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    MILESTONE_AFTER = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ACTOR_USER_ID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    ACTOR_USER_CODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    ACTOR_ROLE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    REVIEWER_USER_ID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    REVIEWER_USER_CODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    CORRELATION_ID = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    IDEMPOTENCY_KEY = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    REQUEST_ID = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    IP_ADDRESS = table.Column<string>(type: "NVARCHAR2(64)", maxLength: 64, nullable: true),
                    USER_AGENT = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    DEVICE_INFO = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TOPIC_WORKFLOW_AUDITS", x => x.AUDIT_ID);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    USERID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    PASSWORDHASH = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: false),
                    Role = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.USERID);
                    table.UniqueConstraint("AK_Users_USERCODE", x => x.USERCODE);
                });

            migrationBuilder.CreateTable(
                name: "COMMITTEES",
                columns: table => new
                {
                    COMMITTEEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    COMMITTEECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    NAME = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: true),
                    DEFENSEDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    ROOM = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    DEFENSETERMID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    STATUS = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_COMMITTEES", x => x.COMMITTEEID);
                    table.UniqueConstraint("AK_COMMITTEES_COMMITTEECODE", x => x.COMMITTEECODE);
                    table.ForeignKey(
                        name: "FK_COMMITTEES_DEFENSETERMS_DEFENSETERMID",
                        column: x => x.DEFENSETERMID,
                        principalTable: "DEFENSETERMS",
                        principalColumn: "DEFENSETERMID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CATALOGTOPICS",
                columns: table => new
                {
                    CATALOGTOPICID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CATALOGTOPICCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    TITLE = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: false),
                    SUMMARY = table.Column<string>(type: "NVARCHAR2(1000)", maxLength: 1000, nullable: true),
                    DEPARTMENTID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    DEPARTMENTCODE = table.Column<string>(type: "NVARCHAR2(30)", nullable: true),
                    ASSIGNEDSTATUS = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    ASSIGNEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CATALOGTOPICS", x => x.CATALOGTOPICID);
                    table.UniqueConstraint("AK_CATALOGTOPICS_CATALOGTOPICCODE", x => x.CATALOGTOPICCODE);
                    table.ForeignKey(
                        name: "FK_CATALOGTOPICS_DEPARTMENTS_DEPARTMENTCODE",
                        column: x => x.DEPARTMENTCODE,
                        principalTable: "DEPARTMENTS",
                        principalColumn: "DEPARTMENTCODE");
                });

            migrationBuilder.CreateTable(
                name: "CLASSES",
                columns: table => new
                {
                    CLASSID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CLASSCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    CLASSNAME = table.Column<string>(type: "NVARCHAR2(150)", maxLength: 150, nullable: false),
                    DEPARTMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    DEPARTMENTCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    COHORT_CODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    ENROLLMENTYEAR = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    STATUS = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true, defaultValue: "Đang hoạt động"),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CLASSES", x => x.CLASSID);
                    table.ForeignKey(
                        name: "FK_CLASSES_DEPARTMENTS_DEPARTMENTID",
                        column: x => x.DEPARTMENTID,
                        principalTable: "DEPARTMENTS",
                        principalColumn: "DEPARTMENTID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CHAT_SESSIONS",
                columns: table => new
                {
                    CHAT_SESSION_ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    USER_ID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TITLE = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: true),
                    MODEL_NAME = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    IS_ARCHIVED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CHAT_SESSIONS", x => x.CHAT_SESSION_ID);
                    table.ForeignKey(
                        name: "FK_CHAT_SESSIONS_Users_USER_ID",
                        column: x => x.USER_ID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CONVERSATIONS",
                columns: table => new
                {
                    CONVERSATIONID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CONVERSATIONCODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    CONVERSATIONTYPE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    TITLE = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: true),
                    CREATEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    CREATEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    AVATARURL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    LASTMESSAGEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    LASTMESSAGEPREVIEW = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    LASTMESSAGEAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    ISARCHIVED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CONVERSATIONS", x => x.CONVERSATIONID);
                    table.ForeignKey(
                        name: "FK_CONVERSATIONS_Users_CREATEDBYUSERID",
                        column: x => x.CREATEDBYUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSESCORES",
                columns: table => new
                {
                    SCOREID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    SCORECODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: false),
                    ASSIGNMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    ASSIGNMENTCODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    MEMBERLECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    MEMBERLECTURERCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    MEMBERLECTURERUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    MEMBERLECTURERUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    SCORE = table.Column<decimal>(type: "NUMBER(5,2)", nullable: false),
                    Comment = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ISSUBMITTED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    REVISION_REQUIRED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    REVISION_REASON = table.Column<string>(type: "NVARCHAR2(1000)", maxLength: 1000, nullable: true),
                    REVISION_DEADLINE_DAYS = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSESCORES", x => x.SCOREID);
                    table.ForeignKey(
                        name: "FK_DEFENSESCORES_Users_MEMBERLECTURERUSERCODE",
                        column: x => x.MEMBERLECTURERUSERCODE,
                        principalTable: "Users",
                        principalColumn: "USERCODE",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "LECTURERPROFILES",
                columns: table => new
                {
                    LECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    LECTURERCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    USERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", nullable: true),
                    DEPARTMENTID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    DEPARTMENTCODE = table.Column<string>(type: "NVARCHAR2(30)", nullable: true),
                    DEGREE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    SPECIALTIES = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    FULLNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    ORGANIZATION = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    GUIDEQUOTA = table.Column<int>(type: "NUMBER(10)", nullable: true, defaultValue: 10),
                    DEFENSEQUOTA = table.Column<int>(type: "NUMBER(10)", nullable: true, defaultValue: 8),
                    CURRENTGUIDINGCOUNT = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    GENDER = table.Column<string>(type: "NVARCHAR2(10)", maxLength: 10, nullable: true),
                    DATEOFBIRTH = table.Column<DateTime>(type: "date", nullable: true),
                    EMAIL = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    PHONENUMBER = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    PROFILEIMAGE = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    ADDRESS = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    NOTES = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LECTURERPROFILES", x => x.LECTURERPROFILEID);
                    table.UniqueConstraint("AK_LECTURERPROFILES_LECTURERCODE", x => x.LECTURERCODE);
                    table.ForeignKey(
                        name: "FK_LECTURERPROFILES_DEPARTMENTS_DEPARTMENTCODE",
                        column: x => x.DEPARTMENTCODE,
                        principalTable: "DEPARTMENTS",
                        principalColumn: "DEPARTMENTCODE");
                    table.ForeignKey(
                        name: "FK_LECTURERPROFILES_Users_USERCODE",
                        column: x => x.USERCODE,
                        principalTable: "Users",
                        principalColumn: "USERCODE");
                });

            migrationBuilder.CreateTable(
                name: "NOTIFICATION_PREFERENCES",
                columns: table => new
                {
                    PREFERENCE_ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    TARGET_USER_ID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TARGET_USER_CODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    NOTIF_CATEGORY = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    IN_APP_ENABLED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 1),
                    EMAIL_ENABLED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    PUSH_ENABLED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    DIGEST_MODE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false, defaultValue: "IMMEDIATE"),
                    QUIET_FROM = table.Column<string>(type: "NVARCHAR2(5)", maxLength: 5, nullable: true),
                    QUIET_TO = table.Column<string>(type: "NVARCHAR2(5)", maxLength: 5, nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NOTIFICATION_PREFERENCES", x => x.PREFERENCE_ID);
                    table.ForeignKey(
                        name: "FK_NOTIFICATION_PREFERENCES_Users_TARGET_USER_ID",
                        column: x => x.TARGET_USER_ID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NOTIFICATION_RECIPIENTS",
                columns: table => new
                {
                    RECIPIENT_ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    NOTIFICATION_ID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TARGET_USER_ID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TARGET_USER_CODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    DELIVERY_STATE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false, defaultValue: "PENDING"),
                    IS_READ = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    READ_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    SEEN_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    DISMISSED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    DELIVERED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    ERROR_MESSAGE = table.Column<string>(type: "NVARCHAR2(1000)", maxLength: 1000, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    UPDATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NOTIFICATION_RECIPIENTS", x => x.RECIPIENT_ID);
                    table.ForeignKey(
                        name: "FK_NOTIFICATION_RECIPIENTS_Users_TARGET_USER_ID",
                        column: x => x.TARGET_USER_ID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_NOTIF_RECIPIENTS_NOTIFICATION",
                        column: x => x.NOTIFICATION_ID,
                        principalTable: "NOTIFICATIONS",
                        principalColumn: "NOTIFICATION_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SYSTEMACTIVITYLOGS",
                columns: table => new
                {
                    LOGID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ENTITYNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    ENTITYID = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    ACTIONTYPE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    ACTIONDESCRIPTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    OLDVALUE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    NEWVALUE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    USERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    USERROLE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    IPADDRESS = table.Column<string>(type: "NVARCHAR2(45)", maxLength: 45, nullable: true),
                    DEVICEINFO = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    MODULE = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    PERFORMEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    STATUS = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    RELATEDRECORDCODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    Comment = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SYSTEMACTIVITYLOGS", x => x.LOGID);
                    table.ForeignKey(
                        name: "FK_SYSTEMACTIVITYLOGS_Users_USERID",
                        column: x => x.USERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "COMMITTEESESSIONS",
                columns: table => new
                {
                    COMMITTEESESSIONID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    COMMITTEEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    COMMITTEECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    SESSIONNUMBER = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SCHEDULEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    TOPICCOUNT = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_COMMITTEESESSIONS", x => x.COMMITTEESESSIONID);
                    table.ForeignKey(
                        name: "FK_COMMITTEESESSIONS_COMMITTEES_COMMITTEECODE",
                        column: x => x.COMMITTEECODE,
                        principalTable: "COMMITTEES",
                        principalColumn: "COMMITTEECODE",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "COMMITTEETAGS",
                columns: table => new
                {
                    COMMITTEETAGID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    COMMITTEEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    COMMITTEECODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    TAGID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TAGCODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_COMMITTEETAGS", x => x.COMMITTEETAGID);
                    table.ForeignKey(
                        name: "FK_COMMITTEETAGS_COMMITTEES_COMMITTEEID",
                        column: x => x.COMMITTEEID,
                        principalTable: "COMMITTEES",
                        principalColumn: "COMMITTEEID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_COMMITTEETAGS_TAGS_TAGID",
                        column: x => x.TAGID,
                        principalTable: "TAGS",
                        principalColumn: "TAGID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CATALOGTOPICTAGS",
                columns: table => new
                {
                    CATALOGTOPICID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TAGID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    CATALOGTOPICCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    TAGCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CATALOGTOPICTAGS", x => new { x.CATALOGTOPICID, x.TAGID });
                    table.ForeignKey(
                        name: "FK_CATALOGTOPICTAGS_CATALOGTOPICS_CATALOGTOPICID",
                        column: x => x.CATALOGTOPICID,
                        principalTable: "CATALOGTOPICS",
                        principalColumn: "CATALOGTOPICID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CATALOGTOPICTAGS_TAGS_TAGID",
                        column: x => x.TAGID,
                        principalTable: "TAGS",
                        principalColumn: "TAGID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TOPICS",
                columns: table => new
                {
                    TOPICID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    TOPICCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    TITLE = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    SUMMARY = table.Column<string>(type: "NVARCHAR2(1000)", maxLength: 1000, nullable: true),
                    Type = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    PROPOSERUSERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    PROPOSERUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    PROPOSERSTUDENTCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    PROPOSERSTUDENTPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    SUPERVISORUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    SUPERVISORUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    SUPERVISORLECTURERCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    SUPERVISORLECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    CATALOGTOPICID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    CATALOGTOPICCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    DEPARTMENTID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    DEPARTMENTCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    DEFENSETERMID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    SCORE = table.Column<decimal>(type: "DECIMAL(5,2)", precision: 5, scale: 2, nullable: true),
                    STATUS = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    RESUBMITCOUNT = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LECTURERCOMMENT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEW_QUALITY = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEW_ATTITUDE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEW_CAPABILITY = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEW_RESULT_PROCESSING = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEW_ACHIEVEMENTS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEW_LIMITATIONS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEW_CONCLUSION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SCORE_IN_WORDS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    NUM_CHAPTERS = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    NUM_PAGES = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    NUM_TABLES = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    NUM_FIGURES = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    NUM_REFERENCES = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    NUM_VN_REFERENCES = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    NUM_FOREIGN_REFERENCES = table.Column<int>(type: "NUMBER(10)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TOPICS", x => x.TOPICID);
                    table.UniqueConstraint("AK_TOPICS_TOPICCODE", x => x.TOPICCODE);
                    table.ForeignKey(
                        name: "FK_TOPICS_CATALOGTOPICS_CATALOGTOPICCODE",
                        column: x => x.CATALOGTOPICCODE,
                        principalTable: "CATALOGTOPICS",
                        principalColumn: "CATALOGTOPICCODE");
                    table.ForeignKey(
                        name: "FK_TOPICS_CATALOGTOPICS_CATALOGTOPICID",
                        column: x => x.CATALOGTOPICID,
                        principalTable: "CATALOGTOPICS",
                        principalColumn: "CATALOGTOPICID");
                    table.ForeignKey(
                        name: "FK_TOPICS_DEFENSETERMS_DEFENSETERMID",
                        column: x => x.DEFENSETERMID,
                        principalTable: "DEFENSETERMS",
                        principalColumn: "DEFENSETERMID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TOPICS_DEPARTMENTS_DEPARTMENTID",
                        column: x => x.DEPARTMENTID,
                        principalTable: "DEPARTMENTS",
                        principalColumn: "DEPARTMENTID");
                    table.ForeignKey(
                        name: "FK_TOPICS_Users_PROPOSERUSERCODE",
                        column: x => x.PROPOSERUSERCODE,
                        principalTable: "Users",
                        principalColumn: "USERCODE",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TOPICTAGS",
                columns: table => new
                {
                    TOPICTAGID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CATALOGTOPICCODE = table.Column<string>(type: "NVARCHAR2(40)", nullable: true),
                    TOPICCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    TAGID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TAGCODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TOPICTAGS", x => x.TOPICTAGID);
                    table.ForeignKey(
                        name: "FK_TOPICTAGS_CATALOGTOPICS_CATALOGTOPICCODE",
                        column: x => x.CATALOGTOPICCODE,
                        principalTable: "CATALOGTOPICS",
                        principalColumn: "CATALOGTOPICCODE");
                    table.ForeignKey(
                        name: "FK_TOPICTAGS_TAGS_TAGID",
                        column: x => x.TAGID,
                        principalTable: "TAGS",
                        principalColumn: "TAGID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "STUDENTPROFILES",
                columns: table => new
                {
                    STUDENTPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    STUDENTCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    USERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DEPARTMENTID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    DEPARTMENTCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CLASSID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    CLASSCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    FACULTYCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    STUDENTIMAGE = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    GPA = table.Column<decimal>(type: "DECIMAL(18, 2)", nullable: true),
                    ACADEMICSTANDING = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    GENDER = table.Column<string>(type: "NVARCHAR2(10)", maxLength: 10, nullable: true),
                    DATEOFBIRTH = table.Column<DateTime>(type: "date", nullable: true),
                    PHONENUMBER = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    STUDENTEMAIL = table.Column<string>(type: "NVARCHAR2(150)", maxLength: 150, nullable: true),
                    ADDRESS = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    ENROLLMENTYEAR = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    STATUS = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true, defaultValue: "Đang học"),
                    GRADUATIONYEAR = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    NOTES = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    FULLNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_STUDENTPROFILES", x => x.STUDENTPROFILEID);
                    table.UniqueConstraint("AK_STUDENTPROFILES_STUDENTCODE", x => x.STUDENTCODE);
                    table.ForeignKey(
                        name: "FK_STUDENTPROFILES_CLASSES_CLASSID",
                        column: x => x.CLASSID,
                        principalTable: "CLASSES",
                        principalColumn: "CLASSID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_STUDENTPROFILES_DEPARTMENTS_DEPARTMENTID",
                        column: x => x.DEPARTMENTID,
                        principalTable: "DEPARTMENTS",
                        principalColumn: "DEPARTMENTID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_STUDENTPROFILES_Users_USERID",
                        column: x => x.USERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CHAT_MESSAGES",
                columns: table => new
                {
                    CHAT_MESSAGE_ID = table.Column<long>(type: "NUMBER(19)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CHAT_SESSION_ID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    ROLE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    CONTENT = table.Column<string>(type: "CLOB", nullable: false),
                    FEEDBACK = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    PROMPT_TOKENS = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    COMPLETION_TOKENS = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CHAT_MESSAGES", x => x.CHAT_MESSAGE_ID);
                    table.ForeignKey(
                        name: "FK_CHAT_MESSAGES_CHAT_SESSIONS_CHAT_SESSION_ID",
                        column: x => x.CHAT_SESSION_ID,
                        principalTable: "CHAT_SESSIONS",
                        principalColumn: "CHAT_SESSION_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CONVERSATIONMEMBERS",
                columns: table => new
                {
                    MEMBERID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CONVERSATIONID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    CONVERSATIONCODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    USERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    MEMBERROLE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false, defaultValue: "Member"),
                    NICKNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    ISMUTED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    ISPINNED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    LASTREADMESSAGEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    LASTREADAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    UNREADCOUNT = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    JOINEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    LEFTAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CONVERSATIONMEMBERS", x => x.MEMBERID);
                    table.ForeignKey(
                        name: "FK_CONVERSATIONMEMBERS_CONVERSATIONS_CONVERSATIONID",
                        column: x => x.CONVERSATIONID,
                        principalTable: "CONVERSATIONS",
                        principalColumn: "CONVERSATIONID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CONVERSATIONMEMBERS_Users_USERID",
                        column: x => x.USERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MESSAGES",
                columns: table => new
                {
                    MESSAGEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    MESSAGECODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: false),
                    CONVERSATIONID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    CONVERSATIONCODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    SENDERUSERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SENDERUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    CONTENT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    MESSAGETYPE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false, defaultValue: "TEXT"),
                    REPLYTOMESSAGEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    ISEDITED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    ISDELETED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    DELETEDFOREVERYONE = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    SENTAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    EDITEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    DELETEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MESSAGES", x => x.MESSAGEID);
                    table.ForeignKey(
                        name: "FK_MESSAGES_CONVERSATIONS_CONVERSATIONID",
                        column: x => x.CONVERSATIONID,
                        principalTable: "CONVERSATIONS",
                        principalColumn: "CONVERSATIONID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MESSAGES_MESSAGES_REPLYTOMESSAGEID",
                        column: x => x.REPLYTOMESSAGEID,
                        principalTable: "MESSAGES",
                        principalColumn: "MESSAGEID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_MESSAGES_Users_SENDERUSERID",
                        column: x => x.SENDERUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "COMMITTEEMEMBERS",
                columns: table => new
                {
                    COMMITTEEMEMBERID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    COMMITTEEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    COMMITTEECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    MEMBERLECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    MEMBERLECTURERCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: true),
                    MEMBERUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    MEMBERUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    ROLE = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    ISCHAIR = table.Column<int>(type: "NUMBER(10)", nullable: true, defaultValue: 0),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_COMMITTEEMEMBERS", x => x.COMMITTEEMEMBERID);
                    table.ForeignKey(
                        name: "FK_COMMITTEEMEMBERS_COMMITTEES_COMMITTEECODE",
                        column: x => x.COMMITTEECODE,
                        principalTable: "COMMITTEES",
                        principalColumn: "COMMITTEECODE",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_COMMITTEEMEMBERS_COMMITTEES_COMMITTEEID",
                        column: x => x.COMMITTEEID,
                        principalTable: "COMMITTEES",
                        principalColumn: "COMMITTEEID");
                    table.ForeignKey(
                        name: "FK_COMMITTEEMEMBERS_LECTURERPROFILES_MEMBERLECTURERCODE",
                        column: x => x.MEMBERLECTURERCODE,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERCODE",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_COMMITTEEMEMBERS_Users_MEMBERUSERCODE",
                        column: x => x.MEMBERUSERCODE,
                        principalTable: "Users",
                        principalColumn: "USERCODE",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSETERMLECTURERS",
                columns: table => new
                {
                    DEFENSETERMLECTURERID = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValueSql: "DEFENSETERMLECTURERS_SEQ.NEXTVAL"),
                    DEFENSETERMID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LECTURERCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    ISPRIMARY = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSETERMLECTURERS", x => x.DEFENSETERMLECTURERID);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMLECTURERS_DEFENSETERMS_DEFENSETERMID",
                        column: x => x.DEFENSETERMID,
                        principalTable: "DEFENSETERMS",
                        principalColumn: "DEFENSETERMID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMLECTURERS_LECTURERPROFILES_LECTURERCODE",
                        column: x => x.LECTURERCODE,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERCODE",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMLECTURERS_LECTURERPROFILES_LECTURERPROFILEID",
                        column: x => x.LECTURERPROFILEID,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERPROFILEID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMLECTURERS_Users_USERCODE",
                        column: x => x.USERCODE,
                        principalTable: "Users",
                        principalColumn: "USERCODE",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LECTURERTAGS",
                columns: table => new
                {
                    LECTURERTAGID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    LECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LECTURERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    TAGID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TAGCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    ASSIGNEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    ASSIGNEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    ASSIGNEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LECTURERTAGS", x => x.LECTURERTAGID);
                    table.ForeignKey(
                        name: "FK_LECTURERTAGS_LECTURERPROFILES_LECTURERPROFILEID",
                        column: x => x.LECTURERPROFILEID,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERPROFILEID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LECTURERTAGS_TAGS_TAGID",
                        column: x => x.TAGID,
                        principalTable: "TAGS",
                        principalColumn: "TAGID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LECTURERTAGS_Users_ASSIGNEDBYUSERCODE",
                        column: x => x.ASSIGNEDBYUSERCODE,
                        principalTable: "Users",
                        principalColumn: "USERCODE",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSEASSIGNMENTS",
                columns: table => new
                {
                    ASSIGNMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ASSIGNMENTCODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: false),
                    TOPICID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    TOPICCODE = table.Column<string>(type: "NVARCHAR2(40)", nullable: true),
                    COMMITTEEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    DEFENSETERMID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    COMMITTEECODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SCHEDULEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    SHIFT = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    ORDERINDEX = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSEASSIGNMENTS", x => x.ASSIGNMENTID);
                    table.ForeignKey(
                        name: "FK_DEFENSEASSIGNMENTS_COMMITTEES_COMMITTEEID",
                        column: x => x.COMMITTEEID,
                        principalTable: "COMMITTEES",
                        principalColumn: "COMMITTEEID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DEFENSEASSIGNMENTS_DEFENSETERMS_DEFENSETERMID",
                        column: x => x.DEFENSETERMID,
                        principalTable: "DEFENSETERMS",
                        principalColumn: "DEFENSETERMID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_DEFENSEASSIGNMENTS_TOPICS_TOPICCODE",
                        column: x => x.TOPICCODE,
                        principalTable: "TOPICS",
                        principalColumn: "TOPICCODE");
                });

            migrationBuilder.CreateTable(
                name: "PROGRESSMILESTONES",
                columns: table => new
                {
                    MILESTONEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    MILESTONECODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: false),
                    TOPICID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TOPICCODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    MILESTONETEMPLATECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    Ordinal = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    DEADLINE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    STATE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true, defaultValue: "Chưa bắt đầu"),
                    STARTEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    COMPLETEDAT1 = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    COMPLETEDAT2 = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    COMPLETEDAT3 = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    COMPLETEDAT4 = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    COMPLETEDAT5 = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PROGRESSMILESTONES", x => x.MILESTONEID);
                    table.ForeignKey(
                        name: "FK_PROGRESSMILESTONES_MILESTONETEMPLATES_MILESTONETEMPLATECODE",
                        column: x => x.MILESTONETEMPLATECODE,
                        principalTable: "MILESTONETEMPLATES",
                        principalColumn: "MILESTONETEMPLATECODE",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PROGRESSMILESTONES_TOPICS_TOPICID",
                        column: x => x.TOPICID,
                        principalTable: "TOPICS",
                        principalColumn: "TOPICID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TOPIC_RENAME_REQUESTS",
                columns: table => new
                {
                    REQUESTID = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValueSql: "TOPIC_RENAME_REQUESTS_SEQ.NEXTVAL"),
                    REQUESTCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    TOPICID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    TOPICCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    OLDTITLE = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: false),
                    NEWTITLE = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: false),
                    REASON = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    STATUS = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    REQUESTEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    REQUESTEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    REQUESTEDBYROLE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    REVIEWEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    REVIEWEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    REVIEWEDBYROLE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    REVIEWCOMMENT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REQUESTEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    REVIEWEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    APPLIEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    GENERATEDFILEURL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    GENERATEDFILENAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    GENERATEDFILESIZE = table.Column<long>(type: "NUMBER(19)", nullable: true),
                    GENERATEDFILEHASH = table.Column<string>(type: "NVARCHAR2(64)", maxLength: 64, nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TOPIC_RENAME_REQUESTS", x => x.REQUESTID);
                    table.ForeignKey(
                        name: "FK_TOPIC_RENAME_REQUESTS_TOPICS_TOPICID",
                        column: x => x.TOPICID,
                        principalTable: "TOPICS",
                        principalColumn: "TOPICID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TOPIC_RENAME_REQUESTS_Users_REQUESTEDBYUSERID",
                        column: x => x.REQUESTEDBYUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TOPIC_RENAME_REQUESTS_Users_REVIEWEDBYUSERID",
                        column: x => x.REVIEWEDBYUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TOPICLECTURERS",
                columns: table => new
                {
                    TOPICID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    TOPICCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LECTURERCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ISPRIMARY = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TOPICLECTURERS", x => new { x.TOPICID, x.LECTURERPROFILEID });
                    table.ForeignKey(
                        name: "FK_TOPICLECTURERS_LECTURERPROFILES_LECTURERPROFILEID",
                        column: x => x.LECTURERPROFILEID,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERPROFILEID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TOPICLECTURERS_TOPICS_TOPICID",
                        column: x => x.TOPICID,
                        principalTable: "TOPICS",
                        principalColumn: "TOPICID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSETERMSTUDENTS",
                columns: table => new
                {
                    DEFENSETERMSTUDENTID = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValueSql: "DEFENSETERMSTUDENTS_SEQ.NEXTVAL"),
                    DEFENSETERMID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    STUDENTPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    STUDENTCODE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSETERMSTUDENTS", x => x.DEFENSETERMSTUDENTID);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMSTUDENTS_DEFENSETERMS_DEFENSETERMID",
                        column: x => x.DEFENSETERMID,
                        principalTable: "DEFENSETERMS",
                        principalColumn: "DEFENSETERMID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMSTUDENTS_STUDENTPROFILES_STUDENTCODE",
                        column: x => x.STUDENTCODE,
                        principalTable: "STUDENTPROFILES",
                        principalColumn: "STUDENTCODE",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMSTUDENTS_STUDENTPROFILES_STUDENTPROFILEID",
                        column: x => x.STUDENTPROFILEID,
                        principalTable: "STUDENTPROFILES",
                        principalColumn: "STUDENTPROFILEID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DEFENSETERMSTUDENTS_Users_USERCODE",
                        column: x => x.USERCODE,
                        principalTable: "Users",
                        principalColumn: "USERCODE",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MESSAGEATTACHMENTS",
                columns: table => new
                {
                    ATTACHMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    MESSAGEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    FILEURL = table.Column<string>(type: "NVARCHAR2(1024)", maxLength: 1024, nullable: false),
                    FILENAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    MIMETYPE = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    FILESIZEBYTES = table.Column<long>(type: "NUMBER(19)", nullable: true),
                    THUMBNAILURL = table.Column<string>(type: "NVARCHAR2(1000)", maxLength: 1000, nullable: true),
                    UPLOADEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MESSAGEATTACHMENTS", x => x.ATTACHMENTID);
                    table.ForeignKey(
                        name: "FK_MESSAGEATTACHMENTS_MESSAGES_MESSAGEID",
                        column: x => x.MESSAGEID,
                        principalTable: "MESSAGES",
                        principalColumn: "MESSAGEID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MESSAGEREACTIONS",
                columns: table => new
                {
                    REACTIONID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    MESSAGEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    USERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    REACTIONTYPE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    REACTEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MESSAGEREACTIONS", x => x.REACTIONID);
                    table.ForeignKey(
                        name: "FK_MESSAGEREACTIONS_MESSAGES_MESSAGEID",
                        column: x => x.MESSAGEID,
                        principalTable: "MESSAGES",
                        principalColumn: "MESSAGEID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MESSAGEREACTIONS_Users_USERID",
                        column: x => x.USERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MESSAGEREADRECEIPTS",
                columns: table => new
                {
                    RECEIPTID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    MESSAGEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    USERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    USERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    READAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MESSAGEREADRECEIPTS", x => x.RECEIPTID);
                    table.ForeignKey(
                        name: "FK_MESSAGEREADRECEIPTS_MESSAGES_MESSAGEID",
                        column: x => x.MESSAGEID,
                        principalTable: "MESSAGES",
                        principalColumn: "MESSAGEID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MESSAGEREADRECEIPTS_Users_USERID",
                        column: x => x.USERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSE_DOCUMENTS",
                columns: table => new
                {
                    DOCUMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ASSIGNMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    DOCUMENTTYPE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false),
                    FILEURL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: false),
                    GENERATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSE_DOCUMENTS", x => x.DOCUMENTID);
                    table.ForeignKey(
                        name: "FK_DEFENSE_DOCUMENTS_DEFENSEASSIGNMENTS_ASSIGNMENTID",
                        column: x => x.ASSIGNMENTID,
                        principalTable: "DEFENSEASSIGNMENTS",
                        principalColumn: "ASSIGNMENTID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSE_MINUTES",
                columns: table => new
                {
                    MINUTEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ASSIGNMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SECRETARY_ID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SUMMARYCONTENT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REVIEWERCOMMENTS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    QNA_DETAILS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    STRENGTHS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    WEAKNESSES = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    RECOMMENDATIONS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSE_MINUTES", x => x.MINUTEID);
                    table.ForeignKey(
                        name: "FK_DEFENSE_MINUTES_DEFENSEASSIGNMENTS_ASSIGNMENTID",
                        column: x => x.ASSIGNMENTID,
                        principalTable: "DEFENSEASSIGNMENTS",
                        principalColumn: "ASSIGNMENTID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DEFENSE_MINUTES_LECTURERPROFILES_SECRETARY_ID",
                        column: x => x.SECRETARY_ID,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERPROFILEID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSE_RESULTS",
                columns: table => new
                {
                    RESULTID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ASSIGNMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SCORE_GVHD = table.Column<decimal>(type: "NUMBER(5,2)", nullable: true),
                    SCORE_CT = table.Column<decimal>(type: "NUMBER(5,2)", nullable: true),
                    SCORE_UVTK = table.Column<decimal>(type: "NUMBER(5,2)", nullable: true),
                    SCORE_UVPB = table.Column<decimal>(type: "NUMBER(5,2)", nullable: true),
                    FINALSCORE_NUMERIC = table.Column<decimal>(type: "NUMBER(5,2)", nullable: true),
                    FINALSCORE_TEXT = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    IS_PASSED = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    ISLOCKED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSE_RESULTS", x => x.RESULTID);
                    table.ForeignKey(
                        name: "FK_DEFENSE_RESULTS_DEFENSEASSIGNMENTS_ASSIGNMENTID",
                        column: x => x.ASSIGNMENTID,
                        principalTable: "DEFENSEASSIGNMENTS",
                        principalColumn: "ASSIGNMENTID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DEFENSE_REVISIONS",
                columns: table => new
                {
                    REVISIONID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ASSIGNMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    REQUIRED_REVISION_CONTENT = table.Column<string>(type: "NCLOB", nullable: true),
                    REVISION_REASON = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    SUBMISSION_DEADLINE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    REVISEDCONTENT = table.Column<string>(type: "NCLOB", nullable: true),
                    REVISIONFILEURL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    SUBMISSION_COUNT = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 1),
                    REVISION_STATUS = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: false, defaultValue: "WaitingStudent"),
                    SECRETARY_COMMENT = table.Column<string>(type: "NCLOB", nullable: true),
                    SECRETARY_USER_CODE = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    SECRETARY_APPROVED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    IS_GVHD_APPROVED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    IS_UVTK_APPROVED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    IS_CT_APPROVED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    FINALSTATUS = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DEFENSE_REVISIONS", x => x.REVISIONID);
                    table.ForeignKey(
                        name: "FK_DEFENSE_REVISIONS_DEFENSEASSIGNMENTS_ASSIGNMENTID",
                        column: x => x.ASSIGNMENTID,
                        principalTable: "DEFENSEASSIGNMENTS",
                        principalColumn: "ASSIGNMENTID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EVALUATION_REVIEWS",
                columns: table => new
                {
                    REVIEWID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ASSIGNMENTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    REVIEWTYPE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    CRITERIA_1_TEXT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CRITERIA_2_TEXT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CRITERIA_3_TEXT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CRITERIA_4_TEXT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LIMITATIONS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SUGGESTIONS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    NUMERICSCORE = table.Column<decimal>(type: "NUMBER(5,2)", nullable: true),
                    TEXTSCORE = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    IS_APPROVED = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 0),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EVALUATION_REVIEWS", x => x.REVIEWID);
                    table.ForeignKey(
                        name: "FK_EVALUATION_REVIEWS_DEFENSEASSIGNMENTS_ASSIGNMENTID",
                        column: x => x.ASSIGNMENTID,
                        principalTable: "DEFENSEASSIGNMENTS",
                        principalColumn: "ASSIGNMENTID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EVALUATION_REVIEWS_LECTURERPROFILES_LECTURERPROFILEID",
                        column: x => x.LECTURERPROFILEID,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERPROFILEID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PROGRESSSUBMISSIONS",
                columns: table => new
                {
                    SUBMISSIONID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    SUBMISSIONCODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: false),
                    MILESTONEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    MILESTONECODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    STUDENTUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    STUDENTUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    STUDENTPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    STUDENTPROFILECODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    LECTURERPROFILEID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    LECTURERCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    Ordinal = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    SUBMITTEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    ATTEMPTNUMBER = table.Column<int>(type: "NUMBER(10)", nullable: true, defaultValue: 1),
                    LECTURERCOMMENT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LECTURERSTATE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    FEEDBACKLEVEL = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REPORTTITLE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    REPORTDESCRIPTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PROGRESSSUBMISSIONS", x => x.SUBMISSIONID);
                    table.ForeignKey(
                        name: "FK_PROGRESSSUBMISSIONS_LECTURERPROFILES_LECTURERPROFILEID",
                        column: x => x.LECTURERPROFILEID,
                        principalTable: "LECTURERPROFILES",
                        principalColumn: "LECTURERPROFILEID");
                    table.ForeignKey(
                        name: "FK_PROGRESSSUBMISSIONS_PROGRESSMILESTONES_MILESTONEID",
                        column: x => x.MILESTONEID,
                        principalTable: "PROGRESSMILESTONES",
                        principalColumn: "MILESTONEID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PROGRESSSUBMISSIONS_Users_STUDENTUSERID",
                        column: x => x.STUDENTUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TOPIC_RENAME_REQUEST_FILES",
                columns: table => new
                {
                    FILEID = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValueSql: "TOPIC_RENAME_REQUEST_FILES_SEQ.NEXTVAL"),
                    FILECODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    REQUESTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    FILETYPE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    FILENAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: false),
                    ORIGINALFILENAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    FILEURL = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: false),
                    FILEPATH = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: true),
                    STORAGEPROVIDER = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    MIMETYPE = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    FILESIZE = table.Column<long>(type: "NUMBER(19)", nullable: true),
                    FILEHASH = table.Column<string>(type: "NVARCHAR2(64)", maxLength: 64, nullable: true),
                    FILEVERSION = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 1),
                    ISCURRENT = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValue: 1),
                    UPLOADEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    UPLOADEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TOPIC_RENAME_REQUEST_FILES", x => x.FILEID);
                    table.ForeignKey(
                        name: "FK_TOPIC_RENAME_REQUEST_FILES_TOPIC_RENAME_REQUESTS_REQUESTID",
                        column: x => x.REQUESTID,
                        principalTable: "TOPIC_RENAME_REQUESTS",
                        principalColumn: "REQUESTID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TOPIC_RENAME_REQUEST_FILES_Users_UPLOADEDBYUSERID",
                        column: x => x.UPLOADEDBYUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "TOPIC_TITLE_HISTORY",
                columns: table => new
                {
                    HISTORYID = table.Column<int>(type: "NUMBER(10)", nullable: false, defaultValueSql: "TOPIC_TITLE_HISTORY_SEQ.NEXTVAL"),
                    HISTORYCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    TOPICID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    TOPICCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    REQUESTID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    REQUESTCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    PREVIOUSTITLE = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: false),
                    NEWTITLE = table.Column<string>(type: "NVARCHAR2(500)", maxLength: 500, nullable: false),
                    CHANGETYPE = table.Column<string>(type: "NVARCHAR2(30)", maxLength: 30, nullable: false),
                    CHANGEREASON = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    APPROVALCOMMENT = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CHANGEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    CHANGEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: false),
                    CHANGEDBYROLE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: false),
                    APPROVEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    APPROVEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    APPROVEDBYROLE = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    EFFECTIVEAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    CREATEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP"),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false, defaultValueSql: "SYSTIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TOPIC_TITLE_HISTORY", x => x.HISTORYID);
                    table.ForeignKey(
                        name: "FK_TOPIC_TITLE_HISTORY_TOPICS_TOPICID",
                        column: x => x.TOPICID,
                        principalTable: "TOPICS",
                        principalColumn: "TOPICID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TOPIC_TITLE_HISTORY_TOPIC_RENAME_REQUESTS_REQUESTID",
                        column: x => x.REQUESTID,
                        principalTable: "TOPIC_RENAME_REQUESTS",
                        principalColumn: "REQUESTID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TOPIC_TITLE_HISTORY_Users_APPROVEDBYUSERID",
                        column: x => x.APPROVEDBYUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_TOPIC_TITLE_HISTORY_Users_CHANGEDBYUSERID",
                        column: x => x.CHANGEDBYUSERID,
                        principalTable: "Users",
                        principalColumn: "USERID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SUBMISSIONFILES",
                columns: table => new
                {
                    FILEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    SUBMISSIONID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SUBMISSIONCODE = table.Column<string>(type: "NVARCHAR2(60)", maxLength: 60, nullable: true),
                    FILEURL = table.Column<string>(type: "NVARCHAR2(1024)", maxLength: 1024, nullable: false),
                    FILENAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    FILESIZEBYTES = table.Column<long>(type: "NUMBER(19)", nullable: true),
                    MIMETYPE = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    UPLOADEDAT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true, defaultValueSql: "SYSTIMESTAMP"),
                    UPLOADEDBYUSERCODE = table.Column<string>(type: "NVARCHAR2(40)", maxLength: 40, nullable: true),
                    UPLOADEDBYUSERID = table.Column<int>(type: "NUMBER(10)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SUBMISSIONFILES", x => x.FILEID);
                    table.ForeignKey(
                        name: "FK_SUBMISSIONFILES_PROGRESSSUBMISSIONS_SUBMISSIONID",
                        column: x => x.SUBMISSIONID,
                        principalTable: "PROGRESSSUBMISSIONS",
                        principalColumn: "SUBMISSIONID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CATALOGTOPICS_CATALOGTOPICCODE",
                table: "CATALOGTOPICS",
                column: "CATALOGTOPICCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CATALOGTOPICS_DEPARTMENTCODE",
                table: "CATALOGTOPICS",
                column: "DEPARTMENTCODE");

            migrationBuilder.CreateIndex(
                name: "IX_CATALOGTOPICTAGS_TAGID",
                table: "CATALOGTOPICTAGS",
                column: "TAGID");

            migrationBuilder.CreateIndex(
                name: "IX_CHAT_MESSAGES_CHAT_SESSION_ID",
                table: "CHAT_MESSAGES",
                column: "CHAT_SESSION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CHAT_SESSIONS_USER_ID",
                table: "CHAT_SESSIONS",
                column: "USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CLASSES_CLASSCODE",
                table: "CLASSES",
                column: "CLASSCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CLASSES_DEPARTMENTID",
                table: "CLASSES",
                column: "DEPARTMENTID");

            migrationBuilder.CreateIndex(
                name: "IX_COHORTS_COHORT_CODE",
                table: "COHORTS",
                column: "COHORT_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEECODERESERVATIONS_COMMITTEECODE",
                table: "COMMITTEECODERESERVATIONS",
                column: "COMMITTEECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEECODERESERVATIONS_EXPIRESAT",
                table: "COMMITTEECODERESERVATIONS",
                column: "EXPIRESAT");

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEECODERESERVATIONS_PERIODID_REQUESTKEY",
                table: "COMMITTEECODERESERVATIONS",
                columns: new[] { "PERIODID", "REQUESTKEY" });

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEECODERESERVATIONS_YEAR_SEQUENCE",
                table: "COMMITTEECODERESERVATIONS",
                columns: new[] { "YEAR", "SEQUENCE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEEMEMBERS_COMMITTEECODE",
                table: "COMMITTEEMEMBERS",
                column: "COMMITTEECODE");

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEEMEMBERS_COMMITTEEID",
                table: "COMMITTEEMEMBERS",
                column: "COMMITTEEID");

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEEMEMBERS_MEMBERLECTURERCODE",
                table: "COMMITTEEMEMBERS",
                column: "MEMBERLECTURERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEEMEMBERS_MEMBERUSERCODE",
                table: "COMMITTEEMEMBERS",
                column: "MEMBERUSERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEES_COMMITTEECODE",
                table: "COMMITTEES",
                column: "COMMITTEECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEES_DEFENSETERMID",
                table: "COMMITTEES",
                column: "DEFENSETERMID");

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEES_DEFENSETERMID_DEFENSEDATE_ROOM",
                table: "COMMITTEES",
                columns: new[] { "DEFENSETERMID", "DEFENSEDATE", "ROOM" });

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEESESSIONS_COMMITTEECODE_SESSIONNUMBER",
                table: "COMMITTEESESSIONS",
                columns: new[] { "COMMITTEECODE", "SESSIONNUMBER" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEETAGS_COMMITTEECODE_TAGID",
                table: "COMMITTEETAGS",
                columns: new[] { "COMMITTEECODE", "TAGID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEETAGS_COMMITTEEID",
                table: "COMMITTEETAGS",
                column: "COMMITTEEID");

            migrationBuilder.CreateIndex(
                name: "IX_COMMITTEETAGS_TAGID",
                table: "COMMITTEETAGS",
                column: "TAGID");

            migrationBuilder.CreateIndex(
                name: "IX_CONVERSATIONMEMBERS_CONVERSATIONID_USERCODE",
                table: "CONVERSATIONMEMBERS",
                columns: new[] { "CONVERSATIONID", "USERCODE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CONVERSATIONMEMBERS_USERID",
                table: "CONVERSATIONMEMBERS",
                column: "USERID");

            migrationBuilder.CreateIndex(
                name: "IX_CONVERSATIONS_CONVERSATIONCODE",
                table: "CONVERSATIONS",
                column: "CONVERSATIONCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CONVERSATIONS_CREATEDBYUSERID",
                table: "CONVERSATIONS",
                column: "CREATEDBYUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSE_DOCUMENTS_ASSIGNMENTID",
                table: "DEFENSE_DOCUMENTS",
                column: "ASSIGNMENTID");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSE_MINUTES_ASSIGNMENTID",
                table: "DEFENSE_MINUTES",
                column: "ASSIGNMENTID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSE_MINUTES_SECRETARY_ID",
                table: "DEFENSE_MINUTES",
                column: "SECRETARY_ID");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSE_RESULTS_ASSIGNMENTID",
                table: "DEFENSE_RESULTS",
                column: "ASSIGNMENTID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSE_REVISIONS_ASSIGNMENTID",
                table: "DEFENSE_REVISIONS",
                column: "ASSIGNMENTID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSEASSIGNMENTS_ASSIGNMENTCODE",
                table: "DEFENSEASSIGNMENTS",
                column: "ASSIGNMENTCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSEASSIGNMENTS_COMMITTEEID",
                table: "DEFENSEASSIGNMENTS",
                column: "COMMITTEEID");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSEASSIGNMENTS_DEFENSETERMID",
                table: "DEFENSEASSIGNMENTS",
                column: "DEFENSETERMID");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSEASSIGNMENTS_TOPICCODE",
                table: "DEFENSEASSIGNMENTS",
                column: "TOPICCODE");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSEGROUPS_TERMID_SLOTID",
                table: "DEFENSEGROUPS",
                columns: new[] { "TERMID", "SLOTID" });

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSESCORES_MEMBERLECTURERUSERCODE",
                table: "DEFENSESCORES",
                column: "MEMBERLECTURERUSERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSESCORES_SCORECODE",
                table: "DEFENSESCORES",
                column: "SCORECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMLECTURERS_DEFENSETERMID_LECTURERCODE",
                table: "DEFENSETERMLECTURERS",
                columns: new[] { "DEFENSETERMID", "LECTURERCODE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMLECTURERS_DEFENSETERMID_LECTURERPROFILEID",
                table: "DEFENSETERMLECTURERS",
                columns: new[] { "DEFENSETERMID", "LECTURERPROFILEID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMLECTURERS_DEFENSETERMID_USERCODE",
                table: "DEFENSETERMLECTURERS",
                columns: new[] { "DEFENSETERMID", "USERCODE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMLECTURERS_LECTURERCODE",
                table: "DEFENSETERMLECTURERS",
                column: "LECTURERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMLECTURERS_LECTURERPROFILEID",
                table: "DEFENSETERMLECTURERS",
                column: "LECTURERPROFILEID");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMLECTURERS_USERCODE",
                table: "DEFENSETERMLECTURERS",
                column: "USERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMSTUDENTS_DEFENSETERMID_STUDENTCODE",
                table: "DEFENSETERMSTUDENTS",
                columns: new[] { "DEFENSETERMID", "STUDENTCODE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMSTUDENTS_DEFENSETERMID_STUDENTPROFILEID",
                table: "DEFENSETERMSTUDENTS",
                columns: new[] { "DEFENSETERMID", "STUDENTPROFILEID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMSTUDENTS_DEFENSETERMID_USERCODE",
                table: "DEFENSETERMSTUDENTS",
                columns: new[] { "DEFENSETERMID", "USERCODE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMSTUDENTS_STUDENTCODE",
                table: "DEFENSETERMSTUDENTS",
                column: "STUDENTCODE");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMSTUDENTS_STUDENTPROFILEID",
                table: "DEFENSETERMSTUDENTS",
                column: "STUDENTPROFILEID");

            migrationBuilder.CreateIndex(
                name: "IX_DEFENSETERMSTUDENTS_USERCODE",
                table: "DEFENSETERMSTUDENTS",
                column: "USERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_DEPARTMENTS_DEPARTMENTCODE",
                table: "DEPARTMENTS",
                column: "DEPARTMENTCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EVALUATION_REVIEWS_ASSIGNMENTID",
                table: "EVALUATION_REVIEWS",
                column: "ASSIGNMENTID");

            migrationBuilder.CreateIndex(
                name: "IX_EVALUATION_REVIEWS_LECTURERPROFILEID",
                table: "EVALUATION_REVIEWS",
                column: "LECTURERPROFILEID");

            migrationBuilder.CreateIndex(
                name: "IX_EXPORTFILES_FILECODE",
                table: "EXPORTFILES",
                column: "FILECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IDEMPOTENCY_RECORDS_ACTION_PERIOD_ID_REQUEST_KEY",
                table: "IDEMPOTENCY_RECORDS",
                columns: new[] { "ACTION", "PERIOD_ID", "REQUEST_KEY" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_IDEMPOTENCY_RECORDS_ACTION_PERIOD_ID_REQUEST_KEY_REQUEST_HASH",
                table: "IDEMPOTENCY_RECORDS",
                columns: new[] { "ACTION", "PERIOD_ID", "REQUEST_KEY", "REQUEST_HASH" });

            migrationBuilder.CreateIndex(
                name: "IX_IDEMPOTENCY_RECORDS_EXPIRES_AT",
                table: "IDEMPOTENCY_RECORDS",
                column: "EXPIRES_AT");

            migrationBuilder.CreateIndex(
                name: "IX_LECTURERPROFILES_DEPARTMENTCODE",
                table: "LECTURERPROFILES",
                column: "DEPARTMENTCODE");

            migrationBuilder.CreateIndex(
                name: "IX_LECTURERPROFILES_LECTURERCODE",
                table: "LECTURERPROFILES",
                column: "LECTURERCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LECTURERPROFILES_USERCODE",
                table: "LECTURERPROFILES",
                column: "USERCODE",
                unique: true,
                filter: "\"USERCODE\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_LECTURERTAGS_ASSIGNEDBYUSERCODE",
                table: "LECTURERTAGS",
                column: "ASSIGNEDBYUSERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_LECTURERTAGS_LECTURERPROFILEID_TAGID",
                table: "LECTURERTAGS",
                columns: new[] { "LECTURERPROFILEID", "TAGID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LECTURERTAGS_TAGID",
                table: "LECTURERTAGS",
                column: "TAGID");

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGEATTACHMENTS_MESSAGEID",
                table: "MESSAGEATTACHMENTS",
                column: "MESSAGEID");

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGEREACTIONS_MESSAGEID_USERCODE_REACTIONTYPE",
                table: "MESSAGEREACTIONS",
                columns: new[] { "MESSAGEID", "USERCODE", "REACTIONTYPE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGEREACTIONS_USERID",
                table: "MESSAGEREACTIONS",
                column: "USERID");

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGEREADRECEIPTS_MESSAGEID_USERCODE",
                table: "MESSAGEREADRECEIPTS",
                columns: new[] { "MESSAGEID", "USERCODE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGEREADRECEIPTS_USERID",
                table: "MESSAGEREADRECEIPTS",
                column: "USERID");

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGES_CONVERSATIONID_SENTAT",
                table: "MESSAGES",
                columns: new[] { "CONVERSATIONID", "SENTAT" });

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGES_MESSAGECODE",
                table: "MESSAGES",
                column: "MESSAGECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGES_REPLYTOMESSAGEID",
                table: "MESSAGES",
                column: "REPLYTOMESSAGEID");

            migrationBuilder.CreateIndex(
                name: "IX_MESSAGES_SENDERUSERID",
                table: "MESSAGES",
                column: "SENDERUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_MILESTONETEMPLATES_MILESTONETEMPLATECODE",
                table: "MILESTONETEMPLATES",
                column: "MILESTONETEMPLATECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NOTIF_OUTBOX_STATUS_CREATED_AT",
                table: "NOTIFICATION_OUTBOX",
                columns: new[] { "OUTBOX_STATUS", "CREATED_AT" });

            migrationBuilder.CreateIndex(
                name: "IX_NOTIF_PREF_USER",
                table: "NOTIFICATION_PREFERENCES",
                column: "TARGET_USER_ID");

            migrationBuilder.CreateIndex(
                name: "UQ_NOTIF_PREF_USER_CATEGORY",
                table: "NOTIFICATION_PREFERENCES",
                columns: new[] { "TARGET_USER_ID", "NOTIF_CATEGORY" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NOTIF_RECIPIENTS_STATE",
                table: "NOTIFICATION_RECIPIENTS",
                column: "DELIVERY_STATE");

            migrationBuilder.CreateIndex(
                name: "IX_NOTIF_RECIPIENTS_USER_UNREAD",
                table: "NOTIFICATION_RECIPIENTS",
                columns: new[] { "TARGET_USER_ID", "IS_READ", "CREATED_AT" });

            migrationBuilder.CreateIndex(
                name: "IX_NOTIF_RECIPIENTS_USERCODE_UNREAD",
                table: "NOTIFICATION_RECIPIENTS",
                columns: new[] { "TARGET_USER_CODE", "IS_READ", "CREATED_AT" });

            migrationBuilder.CreateIndex(
                name: "UQ_NOTIF_RECIPIENTS",
                table: "NOTIFICATION_RECIPIENTS",
                columns: new[] { "NOTIFICATION_ID", "TARGET_USER_ID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_NOTIFICATIONS_CATEGORY_CREATED_AT",
                table: "NOTIFICATIONS",
                columns: new[] { "NOTIF_CATEGORY", "CREATED_AT" });

            migrationBuilder.CreateIndex(
                name: "UQ_NOTIFICATIONS_CODE",
                table: "NOTIFICATIONS",
                column: "NOTIFICATION_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PROGRESSMILESTONES_MILESTONECODE",
                table: "PROGRESSMILESTONES",
                column: "MILESTONECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PROGRESSMILESTONES_MILESTONETEMPLATECODE",
                table: "PROGRESSMILESTONES",
                column: "MILESTONETEMPLATECODE");

            migrationBuilder.CreateIndex(
                name: "IX_PROGRESSMILESTONES_TOPICID",
                table: "PROGRESSMILESTONES",
                column: "TOPICID");

            migrationBuilder.CreateIndex(
                name: "IX_PROGRESSSUBMISSIONS_LECTURERPROFILEID",
                table: "PROGRESSSUBMISSIONS",
                column: "LECTURERPROFILEID");

            migrationBuilder.CreateIndex(
                name: "IX_PROGRESSSUBMISSIONS_MILESTONEID",
                table: "PROGRESSSUBMISSIONS",
                column: "MILESTONEID");

            migrationBuilder.CreateIndex(
                name: "IX_PROGRESSSUBMISSIONS_STUDENTUSERID",
                table: "PROGRESSSUBMISSIONS",
                column: "STUDENTUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_PROGRESSSUBMISSIONS_SUBMISSIONCODE",
                table: "PROGRESSSUBMISSIONS",
                column: "SUBMISSIONCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ROOMS_ROOM_CODE",
                table: "ROOMS",
                column: "ROOM_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_STUDENTPROFILES_CLASSID",
                table: "STUDENTPROFILES",
                column: "CLASSID");

            migrationBuilder.CreateIndex(
                name: "IX_STUDENTPROFILES_DEPARTMENTID",
                table: "STUDENTPROFILES",
                column: "DEPARTMENTID");

            migrationBuilder.CreateIndex(
                name: "IX_STUDENTPROFILES_STUDENTCODE",
                table: "STUDENTPROFILES",
                column: "STUDENTCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_STUDENTPROFILES_USERID",
                table: "STUDENTPROFILES",
                column: "USERID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SUBMISSIONFILES_SUBMISSIONID",
                table: "SUBMISSIONFILES",
                column: "SUBMISSIONID");

            migrationBuilder.CreateIndex(
                name: "IX_SYSTEMACTIVITYLOGS_ACTIONTYPE",
                table: "SYSTEMACTIVITYLOGS",
                column: "ACTIONTYPE");

            migrationBuilder.CreateIndex(
                name: "IX_SYSTEMACTIVITYLOGS_ENTITYNAME",
                table: "SYSTEMACTIVITYLOGS",
                column: "ENTITYNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SYSTEMACTIVITYLOGS_MODULE",
                table: "SYSTEMACTIVITYLOGS",
                column: "MODULE");

            migrationBuilder.CreateIndex(
                name: "IX_SYSTEMACTIVITYLOGS_PERFORMEDAT",
                table: "SYSTEMACTIVITYLOGS",
                column: "PERFORMEDAT");

            migrationBuilder.CreateIndex(
                name: "IX_SYSTEMACTIVITYLOGS_USERCODE",
                table: "SYSTEMACTIVITYLOGS",
                column: "USERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_SYSTEMACTIVITYLOGS_USERID",
                table: "SYSTEMACTIVITYLOGS",
                column: "USERID");

            migrationBuilder.CreateIndex(
                name: "IX_TAGS_TAGCODE",
                table: "TAGS",
                column: "TAGCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUEST_FILES_FILECODE",
                table: "TOPIC_RENAME_REQUEST_FILES",
                column: "FILECODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUEST_FILES_REQUESTID_ISCURRENT",
                table: "TOPIC_RENAME_REQUEST_FILES",
                columns: new[] { "REQUESTID", "ISCURRENT" });

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUEST_FILES_UPLOADEDBYUSERID",
                table: "TOPIC_RENAME_REQUEST_FILES",
                column: "UPLOADEDBYUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUESTS_REQUESTCODE",
                table: "TOPIC_RENAME_REQUESTS",
                column: "REQUESTCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUESTS_REQUESTEDBYUSERID",
                table: "TOPIC_RENAME_REQUESTS",
                column: "REQUESTEDBYUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUESTS_REVIEWEDBYUSERID",
                table: "TOPIC_RENAME_REQUESTS",
                column: "REVIEWEDBYUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_RENAME_REQUESTS_TOPICID",
                table: "TOPIC_RENAME_REQUESTS",
                column: "TOPICID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_TITLE_HISTORY_APPROVEDBYUSERID",
                table: "TOPIC_TITLE_HISTORY",
                column: "APPROVEDBYUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_TITLE_HISTORY_CHANGEDBYUSERID",
                table: "TOPIC_TITLE_HISTORY",
                column: "CHANGEDBYUSERID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_TITLE_HISTORY_EFFECTIVEAT",
                table: "TOPIC_TITLE_HISTORY",
                column: "EFFECTIVEAT");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_TITLE_HISTORY_HISTORYCODE",
                table: "TOPIC_TITLE_HISTORY",
                column: "HISTORYCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_TITLE_HISTORY_REQUESTID",
                table: "TOPIC_TITLE_HISTORY",
                column: "REQUESTID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_TITLE_HISTORY_TOPICCODE",
                table: "TOPIC_TITLE_HISTORY",
                column: "TOPICCODE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_TITLE_HISTORY_TOPICID",
                table: "TOPIC_TITLE_HISTORY",
                column: "TOPICID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_ACTION_TYPE",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "ACTION_TYPE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_ACTOR_USER_CODE",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "ACTOR_USER_CODE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_AUDIT_CODE",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "AUDIT_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_CORRELATION_ID",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "CORRELATION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_CREATED_AT",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "CREATED_AT");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_STATUS_CODE",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "STATUS_CODE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_TOPIC_CODE",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "TOPIC_CODE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPIC_WORKFLOW_AUDITS_TOPIC_ID",
                table: "TOPIC_WORKFLOW_AUDITS",
                column: "TOPIC_ID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICLECTURERS_LECTURERPROFILEID",
                table: "TOPICLECTURERS",
                column: "LECTURERPROFILEID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICS_CATALOGTOPICCODE",
                table: "TOPICS",
                column: "CATALOGTOPICCODE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICS_CATALOGTOPICID",
                table: "TOPICS",
                column: "CATALOGTOPICID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICS_DEFENSETERMID",
                table: "TOPICS",
                column: "DEFENSETERMID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICS_DEPARTMENTID",
                table: "TOPICS",
                column: "DEPARTMENTID");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICS_PROPOSERUSERCODE",
                table: "TOPICS",
                column: "PROPOSERUSERCODE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICS_TOPICCODE",
                table: "TOPICS",
                column: "TOPICCODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TOPICTAGS_CATALOGTOPICCODE",
                table: "TOPICTAGS",
                column: "CATALOGTOPICCODE");

            migrationBuilder.CreateIndex(
                name: "IX_TOPICTAGS_TAGID",
                table: "TOPICTAGS",
                column: "TAGID");

            migrationBuilder.CreateIndex(
                name: "IX_Users_USERCODE",
                table: "Users",
                column: "USERCODE",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CATALOGTOPICTAGS");

            migrationBuilder.DropTable(
                name: "CHAT_MESSAGES");

            migrationBuilder.DropTable(
                name: "COHORTS");

            migrationBuilder.DropTable(
                name: "COMMITTEECODERESERVATIONS");

            migrationBuilder.DropTable(
                name: "COMMITTEEMEMBERS");

            migrationBuilder.DropTable(
                name: "COMMITTEESESSIONS");

            migrationBuilder.DropTable(
                name: "COMMITTEETAGS");

            migrationBuilder.DropTable(
                name: "CONVERSATIONMEMBERS");

            migrationBuilder.DropTable(
                name: "DEFENSE_DOCUMENTS");

            migrationBuilder.DropTable(
                name: "DEFENSE_MINUTES");

            migrationBuilder.DropTable(
                name: "DEFENSE_RESULTS");

            migrationBuilder.DropTable(
                name: "DEFENSE_REVISIONS");

            migrationBuilder.DropTable(
                name: "DEFENSEGROUPS");

            migrationBuilder.DropTable(
                name: "DEFENSESCORES");

            migrationBuilder.DropTable(
                name: "DEFENSETERMLECTURERS");

            migrationBuilder.DropTable(
                name: "DEFENSETERMSTUDENTS");

            migrationBuilder.DropTable(
                name: "EVALUATION_REVIEWS");

            migrationBuilder.DropTable(
                name: "EXPORTFILES");

            migrationBuilder.DropTable(
                name: "IDEMPOTENCY_RECORDS");

            migrationBuilder.DropTable(
                name: "LECTURERDASHBOARDVIEW");

            migrationBuilder.DropTable(
                name: "LECTURERTAGS");

            migrationBuilder.DropTable(
                name: "MESSAGEATTACHMENTS");

            migrationBuilder.DropTable(
                name: "MESSAGEREACTIONS");

            migrationBuilder.DropTable(
                name: "MESSAGEREADRECEIPTS");

            migrationBuilder.DropTable(
                name: "NOTIFICATION_OUTBOX");

            migrationBuilder.DropTable(
                name: "NOTIFICATION_PREFERENCES");

            migrationBuilder.DropTable(
                name: "NOTIFICATION_RECIPIENTS");

            migrationBuilder.DropTable(
                name: "ROOMS");

            migrationBuilder.DropTable(
                name: "SUBMISSIONFILES");

            migrationBuilder.DropTable(
                name: "SYNCAUDITLOGS");

            migrationBuilder.DropTable(
                name: "SYSTEMACTIVITYLOGS");

            migrationBuilder.DropTable(
                name: "TOPIC_RENAME_REQUEST_FILES");

            migrationBuilder.DropTable(
                name: "TOPIC_TITLE_HISTORY");

            migrationBuilder.DropTable(
                name: "TOPIC_WORKFLOW_AUDITS");

            migrationBuilder.DropTable(
                name: "TOPICLECTURERS");

            migrationBuilder.DropTable(
                name: "TOPICTAGS");

            migrationBuilder.DropTable(
                name: "CHAT_SESSIONS");

            migrationBuilder.DropTable(
                name: "STUDENTPROFILES");

            migrationBuilder.DropTable(
                name: "DEFENSEASSIGNMENTS");

            migrationBuilder.DropTable(
                name: "MESSAGES");

            migrationBuilder.DropTable(
                name: "NOTIFICATIONS");

            migrationBuilder.DropTable(
                name: "PROGRESSSUBMISSIONS");

            migrationBuilder.DropTable(
                name: "TOPIC_RENAME_REQUESTS");

            migrationBuilder.DropTable(
                name: "TAGS");

            migrationBuilder.DropTable(
                name: "CLASSES");

            migrationBuilder.DropTable(
                name: "COMMITTEES");

            migrationBuilder.DropTable(
                name: "CONVERSATIONS");

            migrationBuilder.DropTable(
                name: "LECTURERPROFILES");

            migrationBuilder.DropTable(
                name: "PROGRESSMILESTONES");

            migrationBuilder.DropTable(
                name: "MILESTONETEMPLATES");

            migrationBuilder.DropTable(
                name: "TOPICS");

            migrationBuilder.DropTable(
                name: "CATALOGTOPICS");

            migrationBuilder.DropTable(
                name: "DEFENSETERMS");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "DEPARTMENTS");
        }
    }
}
