import bcrypt from "bcryptjs";
import { getConnection } from "./oracle";
import { logger } from "./logger";

async function executeStatement(
  conn: import("oracledb").Connection,
  sql: string,
  description: string,
): Promise<boolean> {
  try {
    await conn.execute(sql);
    logger.info(`DB Init: ${description} ✓`);
    return true;
  } catch (err: unknown) {
    const e = err as { errorNum?: number; message?: string };
    // ORA-00955: name already used (object exists) — skip
    // ORA-02261: unique constraint already exists
    if (e.errorNum === 955 || e.errorNum === 2261 || e.errorNum === 1408) {
      logger.info(`DB Init: ${description} (already exists, skipping)`);
      return true;
    }
    logger.warn({ err }, `DB Init: ${description} FAILED`);
    return false;
  }
}

async function tableExists(
  conn: import("oracledb").Connection,
  tableName: string,
): Promise<boolean> {
  const r = await conn.execute<[number]>(
    `SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = :1`,
    [tableName.toUpperCase()],
  );
  return (r.rows?.[0]?.[0] ?? 0) > 0;
}

export async function initDatabase(): Promise<{
  tablesCreated: string[];
  errors: string[];
}> {
  const created: string[] = [];
  const errors: string[] = [];

  let conn: import("oracledb").Connection | null = null;
  try {
    conn = await getConnection();

    // SEQUENCES
    const sequences = [
      ["SEQ_USERS", "CREATE SEQUENCE SEQ_USERS START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_UNIT_TYPES", "CREATE SEQUENCE SEQ_UNIT_TYPES START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_PROJECTS", "CREATE SEQUENCE SEQ_PROJECTS START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_BUILDINGS", "CREATE SEQUENCE SEQ_BUILDINGS START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_FLOORS", "CREATE SEQUENCE SEQ_FLOORS START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_CUSTOMERS", "CREATE SEQUENCE SEQ_CUSTOMERS START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_UNITS", "CREATE SEQUENCE SEQ_UNITS START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_SALES", "CREATE SEQUENCE SEQ_SALES START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
      ["SEQ_UNIT_IMAGES", "CREATE SEQUENCE SEQ_UNIT_IMAGES START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE"],
    ] as const;

    for (const [name, sql] of sequences) {
      await executeStatement(conn, sql, `Sequence ${name}`);
    }

    // USERS table
    if (!(await tableExists(conn, "USERS"))) {
      await executeStatement(
        conn,
        `CREATE TABLE USERS (
          USER_ID       NUMBER        NOT NULL,
          USERNAME      VARCHAR2(100) NOT NULL,
          PASSWORD_HASH VARCHAR2(255) NOT NULL,
          FULL_NAME     VARCHAR2(200) NOT NULL,
          EMAIL         VARCHAR2(200),
          ROLE          VARCHAR2(50)  NOT NULL,
          IS_ACTIVE     NUMBER(1)     DEFAULT 1 NOT NULL,
          CREATED_BY    VARCHAR2(100),
          CREATED_DATE  DATE          DEFAULT SYSDATE,
          UPDATED_BY    VARCHAR2(100),
          UPDATED_DATE  DATE,
          CONSTRAINT PK_USERS PRIMARY KEY (USER_ID),
          CONSTRAINT UQ_USERS_USERNAME UNIQUE (USERNAME),
          CONSTRAINT CHK_USERS_ROLE CHECK (ROLE IN ('ADMIN','ACCOUNTING'))
        )`,
        "Table USERS",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_USERS_ID
        BEFORE INSERT ON USERS FOR EACH ROW
        BEGIN
          IF :NEW.USER_ID IS NULL THEN
            SELECT SEQ_USERS.NEXTVAL INTO :NEW.USER_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_USERS_ID");
      created.push("USERS");
    } else {
      created.push("USERS (exists)");
    }

    // UNIT_TYPES table
    if (!(await tableExists(conn, "UNIT_TYPES"))) {
      await executeStatement(
        conn,
        `CREATE TABLE UNIT_TYPES (
          TYPE_ID      NUMBER        NOT NULL,
          TYPE_NAME    VARCHAR2(200) NOT NULL,
          DESCRIPTION  VARCHAR2(500),
          CREATED_BY   VARCHAR2(100),
          CREATED_DATE DATE          DEFAULT SYSDATE,
          UPDATED_BY   VARCHAR2(100),
          UPDATED_DATE DATE,
          CONSTRAINT PK_UNIT_TYPES PRIMARY KEY (TYPE_ID),
          CONSTRAINT UQ_UNIT_TYPES_NAME UNIQUE (TYPE_NAME)
        )`,
        "Table UNIT_TYPES",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_UNIT_TYPES_ID
        BEFORE INSERT ON UNIT_TYPES FOR EACH ROW
        BEGIN
          IF :NEW.TYPE_ID IS NULL THEN
            SELECT SEQ_UNIT_TYPES.NEXTVAL INTO :NEW.TYPE_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_UNIT_TYPES_ID");
      created.push("UNIT_TYPES");
    } else {
      created.push("UNIT_TYPES (exists)");
    }

    // PROJECTS table
    if (!(await tableExists(conn, "PROJECTS"))) {
      await executeStatement(
        conn,
        `CREATE TABLE PROJECTS (
          PROJECT_ID   NUMBER        NOT NULL,
          PROJECT_NAME VARCHAR2(300) NOT NULL,
          LOCATION     VARCHAR2(500),
          DESCRIPTION  VARCHAR2(2000),
          START_DATE   DATE,
          END_DATE     DATE,
          STATUS       VARCHAR2(50)  DEFAULT 'ACTIVE',
          CREATED_BY   VARCHAR2(100),
          CREATED_DATE DATE          DEFAULT SYSDATE,
          UPDATED_BY   VARCHAR2(100),
          UPDATED_DATE DATE,
          CONSTRAINT PK_PROJECTS PRIMARY KEY (PROJECT_ID),
          CONSTRAINT CHK_PROJECTS_STATUS CHECK (STATUS IN ('ACTIVE','COMPLETED','ON_HOLD'))
        )`,
        "Table PROJECTS",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_PROJECTS_ID
        BEFORE INSERT ON PROJECTS FOR EACH ROW
        BEGIN
          IF :NEW.PROJECT_ID IS NULL THEN
            SELECT SEQ_PROJECTS.NEXTVAL INTO :NEW.PROJECT_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_PROJECTS_ID");
      created.push("PROJECTS");
    } else {
      created.push("PROJECTS (exists)");
    }

    // BUILDINGS table
    if (!(await tableExists(conn, "BUILDINGS"))) {
      await executeStatement(
        conn,
        `CREATE TABLE BUILDINGS (
          BUILDING_ID   NUMBER        NOT NULL,
          PROJECT_ID    NUMBER        NOT NULL,
          BUILDING_NAME VARCHAR2(300) NOT NULL,
          BUILDING_CODE VARCHAR2(100),
          FLOORS_COUNT  NUMBER        DEFAULT 0,
          DESCRIPTION   VARCHAR2(2000),
          CREATED_BY    VARCHAR2(100),
          CREATED_DATE  DATE          DEFAULT SYSDATE,
          UPDATED_BY    VARCHAR2(100),
          UPDATED_DATE  DATE,
          CONSTRAINT PK_BUILDINGS PRIMARY KEY (BUILDING_ID),
          CONSTRAINT FK_BUILDINGS_PROJECT FOREIGN KEY (PROJECT_ID) REFERENCES PROJECTS(PROJECT_ID)
        )`,
        "Table BUILDINGS",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_BUILDINGS_ID
        BEFORE INSERT ON BUILDINGS FOR EACH ROW
        BEGIN
          IF :NEW.BUILDING_ID IS NULL THEN
            SELECT SEQ_BUILDINGS.NEXTVAL INTO :NEW.BUILDING_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_BUILDINGS_ID");
      await executeStatement(conn, "CREATE INDEX IDX_BUILDINGS_PROJECT ON BUILDINGS (PROJECT_ID)", "Index IDX_BUILDINGS_PROJECT");
      created.push("BUILDINGS");
    } else {
      created.push("BUILDINGS (exists)");
    }

    // FLOORS table
    if (!(await tableExists(conn, "FLOORS"))) {
      await executeStatement(
        conn,
        `CREATE TABLE FLOORS (
          FLOOR_ID     NUMBER        NOT NULL,
          BUILDING_ID  NUMBER        NOT NULL,
          FLOOR_NUMBER VARCHAR2(50)  NOT NULL,
          FLOOR_NAME   VARCHAR2(200),
          DESCRIPTION  VARCHAR2(1000),
          CREATED_BY   VARCHAR2(100),
          CREATED_DATE DATE          DEFAULT SYSDATE,
          UPDATED_BY   VARCHAR2(100),
          UPDATED_DATE DATE,
          CONSTRAINT PK_FLOORS PRIMARY KEY (FLOOR_ID),
          CONSTRAINT FK_FLOORS_BUILDING FOREIGN KEY (BUILDING_ID) REFERENCES BUILDINGS(BUILDING_ID)
        )`,
        "Table FLOORS",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_FLOORS_ID
        BEFORE INSERT ON FLOORS FOR EACH ROW
        BEGIN
          IF :NEW.FLOOR_ID IS NULL THEN
            SELECT SEQ_FLOORS.NEXTVAL INTO :NEW.FLOOR_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_FLOORS_ID");
      await executeStatement(conn, "CREATE INDEX IDX_FLOORS_BUILDING ON FLOORS (BUILDING_ID)", "Index IDX_FLOORS_BUILDING");
      created.push("FLOORS");
    } else {
      created.push("FLOORS (exists)");
    }

    // CUSTOMERS table
    if (!(await tableExists(conn, "CUSTOMERS"))) {
      await executeStatement(
        conn,
        `CREATE TABLE CUSTOMERS (
          CUSTOMER_ID   NUMBER        NOT NULL,
          FULL_NAME     VARCHAR2(300) NOT NULL,
          MOBILE        VARCHAR2(20)  NOT NULL,
          EMAIL         VARCHAR2(200),
          NATIONAL_ID   VARCHAR2(100),
          ADDRESS       VARCHAR2(500),
          NOTES         VARCHAR2(2000),
          CREATED_BY    VARCHAR2(100),
          CREATED_DATE  DATE          DEFAULT SYSDATE,
          UPDATED_BY    VARCHAR2(100),
          UPDATED_DATE  DATE,
          CONSTRAINT PK_CUSTOMERS PRIMARY KEY (CUSTOMER_ID)
        )`,
        "Table CUSTOMERS",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_CUSTOMERS_ID
        BEFORE INSERT ON CUSTOMERS FOR EACH ROW
        BEGIN
          IF :NEW.CUSTOMER_ID IS NULL THEN
            SELECT SEQ_CUSTOMERS.NEXTVAL INTO :NEW.CUSTOMER_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_CUSTOMERS_ID");
      await executeStatement(conn, "CREATE INDEX IDX_CUSTOMERS_MOBILE ON CUSTOMERS (MOBILE)", "Index IDX_CUSTOMERS_MOBILE");
      created.push("CUSTOMERS");
    } else {
      created.push("CUSTOMERS (exists)");
    }

    // UNITS table
    if (!(await tableExists(conn, "UNITS"))) {
      await executeStatement(
        conn,
        `CREATE TABLE UNITS (
          UNIT_ID      NUMBER         NOT NULL,
          UNIT_CODE    VARCHAR2(100)  NOT NULL,
          UNIT_NAME    VARCHAR2(300)  NOT NULL,
          TYPE_ID      NUMBER         NOT NULL,
          PROJECT_ID   NUMBER         NOT NULL,
          BUILDING_ID  NUMBER         NOT NULL,
          FLOOR_ID     NUMBER         NOT NULL,
          AREA         NUMBER(10,2)   NOT NULL,
          ROOMS        NUMBER         DEFAULT 0,
          BATHROOMS    NUMBER         DEFAULT 0,
          PRICE        NUMBER(15,2)   NOT NULL,
          STATUS       VARCHAR2(20)   DEFAULT 'AVAILABLE',
          DESCRIPTION  VARCHAR2(2000),
          CREATED_BY   VARCHAR2(100),
          CREATED_DATE DATE           DEFAULT SYSDATE,
          UPDATED_BY   VARCHAR2(100),
          UPDATED_DATE DATE,
          CONSTRAINT PK_UNITS PRIMARY KEY (UNIT_ID),
          CONSTRAINT UQ_UNITS_CODE UNIQUE (UNIT_CODE),
          CONSTRAINT FK_UNITS_TYPE     FOREIGN KEY (TYPE_ID)     REFERENCES UNIT_TYPES(TYPE_ID),
          CONSTRAINT FK_UNITS_PROJECT  FOREIGN KEY (PROJECT_ID)  REFERENCES PROJECTS(PROJECT_ID),
          CONSTRAINT FK_UNITS_BUILDING FOREIGN KEY (BUILDING_ID) REFERENCES BUILDINGS(BUILDING_ID),
          CONSTRAINT FK_UNITS_FLOOR    FOREIGN KEY (FLOOR_ID)    REFERENCES FLOORS(FLOOR_ID),
          CONSTRAINT CHK_UNITS_STATUS  CHECK (STATUS IN ('AVAILABLE','SOLD','RESERVED')),
          CONSTRAINT CHK_UNITS_PRICE   CHECK (PRICE > 0),
          CONSTRAINT CHK_UNITS_AREA    CHECK (AREA > 0)
        )`,
        "Table UNITS",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_UNITS_ID
        BEFORE INSERT ON UNITS FOR EACH ROW
        BEGIN
          IF :NEW.UNIT_ID IS NULL THEN
            SELECT SEQ_UNITS.NEXTVAL INTO :NEW.UNIT_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_UNITS_ID");
      await executeStatement(conn, "CREATE INDEX IDX_UNITS_STATUS ON UNITS (STATUS)", "Index IDX_UNITS_STATUS");
      await executeStatement(conn, "CREATE INDEX IDX_UNITS_PROJECT ON UNITS (PROJECT_ID)", "Index IDX_UNITS_PROJECT");
      await executeStatement(conn, "CREATE INDEX IDX_UNITS_TYPE ON UNITS (TYPE_ID)", "Index IDX_UNITS_TYPE");
      created.push("UNITS");
    } else {
      created.push("UNITS (exists)");
    }

    // SALES table
    if (!(await tableExists(conn, "SALES"))) {
      await executeStatement(
        conn,
        `CREATE TABLE SALES (
          SALE_ID      NUMBER        NOT NULL,
          UNIT_ID      NUMBER        NOT NULL,
          CUSTOMER_ID  NUMBER        NOT NULL,
          SALE_DATE    DATE          NOT NULL,
          SALE_AMOUNT  NUMBER(15,2)  NOT NULL,
          NOTES        VARCHAR2(2000),
          CREATED_BY   VARCHAR2(100),
          CREATED_DATE DATE          DEFAULT SYSDATE,
          UPDATED_BY   VARCHAR2(100),
          UPDATED_DATE DATE,
          CONSTRAINT PK_SALES PRIMARY KEY (SALE_ID),
          CONSTRAINT FK_SALES_UNIT     FOREIGN KEY (UNIT_ID)     REFERENCES UNITS(UNIT_ID),
          CONSTRAINT FK_SALES_CUSTOMER FOREIGN KEY (CUSTOMER_ID) REFERENCES CUSTOMERS(CUSTOMER_ID)
        )`,
        "Table SALES",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_SALES_ID
        BEFORE INSERT ON SALES FOR EACH ROW
        BEGIN
          IF :NEW.SALE_ID IS NULL THEN
            SELECT SEQ_SALES.NEXTVAL INTO :NEW.SALE_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_SALES_ID");
      await executeStatement(conn, "CREATE INDEX IDX_SALES_UNIT ON SALES (UNIT_ID)", "Index IDX_SALES_UNIT");
      await executeStatement(conn, "CREATE INDEX IDX_SALES_DATE ON SALES (SALE_DATE)", "Index IDX_SALES_DATE");
      created.push("SALES");
    } else {
      created.push("SALES (exists)");
    }

    // UNIT_IMAGES table
    if (!(await tableExists(conn, "UNIT_IMAGES"))) {
      await executeStatement(
        conn,
        `CREATE TABLE UNIT_IMAGES (
          IMAGE_ID     NUMBER         NOT NULL,
          UNIT_ID      NUMBER         NOT NULL,
          FILE_NAME    VARCHAR2(500)  NOT NULL,
          FILE_PATH    VARCHAR2(1000) NOT NULL,
          MIME_TYPE    VARCHAR2(100),
          FILE_SIZE    NUMBER,
          IS_PRIMARY   NUMBER(1)      DEFAULT 0,
          CREATED_BY   VARCHAR2(100),
          CREATED_DATE DATE           DEFAULT SYSDATE,
          UPDATED_BY   VARCHAR2(100),
          UPDATED_DATE DATE,
          CONSTRAINT PK_UNIT_IMAGES PRIMARY KEY (IMAGE_ID),
          CONSTRAINT FK_UNIT_IMAGES_UNIT FOREIGN KEY (UNIT_ID) REFERENCES UNITS(UNIT_ID) ON DELETE CASCADE
        )`,
        "Table UNIT_IMAGES",
      );
      await executeStatement(conn, `CREATE OR REPLACE TRIGGER TRG_UNIT_IMAGES_ID
        BEFORE INSERT ON UNIT_IMAGES FOR EACH ROW
        BEGIN
          IF :NEW.IMAGE_ID IS NULL THEN
            SELECT SEQ_UNIT_IMAGES.NEXTVAL INTO :NEW.IMAGE_ID FROM DUAL;
          END IF;
        END;`, "Trigger TRG_UNIT_IMAGES_ID");
      await executeStatement(conn, "CREATE INDEX IDX_UNIT_IMAGES_UNIT ON UNIT_IMAGES (UNIT_ID)", "Index IDX_UNIT_IMAGES_UNIT");
      created.push("UNIT_IMAGES");
    } else {
      created.push("UNIT_IMAGES (exists)");
    }

    // SEED DATA — only if tables are empty
    await seedData(conn);

    await conn.commit();
    logger.info("Database initialization complete");
    return { tablesCreated: created, errors };
  } catch (err) {
    logger.error({ err }, "Database initialization failed");
    errors.push(String(err));
    return { tablesCreated: created, errors };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
}

async function rowCount(
  conn: import("oracledb").Connection,
  table: string,
): Promise<number> {
  try {
    const r = await conn.execute<[number]>(`SELECT COUNT(*) FROM ${table}`);
    return r.rows?.[0]?.[0] ?? 0;
  } catch {
    return 0;
  }
}

async function seedData(conn: import("oracledb").Connection): Promise<void> {
  // Users
  if ((await rowCount(conn, "USERS")) === 0) {
    const adminHash = await bcrypt.hash("admin123", 12);
    const accountsHash = await bcrypt.hash("accounts123", 12);
    await conn.execute(
      `INSERT INTO USERS (USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE, CREATED_BY)
       VALUES (:1, :2, :3, :4, :5, :6)`,
      ["admin", adminHash, "مدير النظام", "admin@system.com", "ADMIN", "SYSTEM"],
    );
    await conn.execute(
      `INSERT INTO USERS (USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE, CREATED_BY)
       VALUES (:1, :2, :3, :4, :5, :6)`,
      ["accounts", accountsHash, "مسؤول الحسابات", "accounts@system.com", "ACCOUNTING", "SYSTEM"],
    );
    logger.info("Seeded: USERS (admin + accounts)");
  }

  // Unit Types
  if ((await rowCount(conn, "UNIT_TYPES")) === 0) {
    const types = [
      ["شقة", "وحدة سكنية في مبنى متعدد الطوابق"],
      ["فيلا", "منزل مستقل مع حديقة"],
      ["دوبلكس", "وحدة سكنية على طابقين"],
      ["مكتب", "مساحة تجارية للأعمال"],
      ["محل تجاري", "محل في الطابق الأرضي"],
    ];
    for (const [name, desc] of types) {
      await conn.execute(
        `INSERT INTO UNIT_TYPES (TYPE_NAME, DESCRIPTION, CREATED_BY) VALUES (:1, :2, :3)`,
        [name, desc, "SYSTEM"],
      );
    }
    logger.info("Seeded: UNIT_TYPES");
  }

  // Projects
  if ((await rowCount(conn, "PROJECTS")) === 0) {
    await conn.execute(
      `INSERT INTO PROJECTS (PROJECT_NAME, LOCATION, DESCRIPTION, START_DATE, STATUS, CREATED_BY)
       VALUES (:1, :2, :3, TO_DATE(:4,'YYYY-MM-DD'), :5, :6)`,
      ["مشروع الأندلس", "الرياض - حي الأندلس", "مجمع سكني فاخر في قلب الرياض", "2023-01-01", "ACTIVE", "SYSTEM"],
    );
    await conn.execute(
      `INSERT INTO PROJECTS (PROJECT_NAME, LOCATION, DESCRIPTION, START_DATE, STATUS, CREATED_BY)
       VALUES (:1, :2, :3, TO_DATE(:4,'YYYY-MM-DD'), :5, :6)`,
      ["برج النخيل", "جدة - كورنيش", "برج سكني تجاري على الكورنيش", "2023-06-01", "ACTIVE", "SYSTEM"],
    );
    await conn.execute(
      `INSERT INTO PROJECTS (PROJECT_NAME, LOCATION, DESCRIPTION, START_DATE, STATUS, CREATED_BY)
       VALUES (:1, :2, :3, TO_DATE(:4,'YYYY-MM-DD'), :5, :6)`,
      ["مجمع الفردوس", "الدمام - حي الفردوس", "مجمع فلل فاخرة", "2022-01-01", "COMPLETED", "SYSTEM"],
    );
    logger.info("Seeded: PROJECTS");
  }

  // Buildings
  if ((await rowCount(conn, "BUILDINGS")) === 0) {
    const buildings = [
      [1, "مبنى A", "AND-A", 10],
      [1, "مبنى B", "AND-B", 8],
      [2, "البرج الرئيسي", "NAK-MAIN", 25],
      [3, "مبنى الفلل", "FAR-V", 2],
    ];
    for (const [pid, name, code, floors] of buildings) {
      await conn.execute(
        `INSERT INTO BUILDINGS (PROJECT_ID, BUILDING_NAME, BUILDING_CODE, FLOORS_COUNT, CREATED_BY)
         VALUES (:1, :2, :3, :4, :5)`,
        [pid, name, code, floors, "SYSTEM"],
      );
    }
    logger.info("Seeded: BUILDINGS");
  }

  // Floors
  if ((await rowCount(conn, "FLOORS")) === 0) {
    const floors = [
      [1, "1", "الطابق الأول"],
      [1, "2", "الطابق الثاني"],
      [1, "3", "الطابق الثالث"],
      [2, "1", "الطابق الأول"],
      [2, "2", "الطابق الثاني"],
      [3, "1", "الطابق الأول"],
      [3, "5", "الطابق الخامس"],
      [3, "10", "الطابق العاشر"],
    ];
    for (const [bid, num, name] of floors) {
      await conn.execute(
        `INSERT INTO FLOORS (BUILDING_ID, FLOOR_NUMBER, FLOOR_NAME, CREATED_BY) VALUES (:1, :2, :3, :4)`,
        [bid, num, name, "SYSTEM"],
      );
    }
    logger.info("Seeded: FLOORS");
  }

  // Customers
  if ((await rowCount(conn, "CUSTOMERS")) === 0) {
    const customers = [
      ["أحمد محمد العمري", "0501234567", "ahmed@example.com", "1234567890", "الرياض - حي النزهة"],
      ["فاطمة علي الزهراني", "0551234567", "fatima@example.com", "2234567890", "جدة - حي الصفاء"],
      ["خالد عبدالله الغامدي", "0561234567", "khalid@example.com", "3234567890", "الدمام - حي العزيزية"],
      ["نورة سعد القحطاني", "0571234567", "noura@example.com", "4234567890", "الرياض - حي الملقا"],
      ["محمد إبراهيم الشهري", "0581234567", "mohammed@example.com", "5234567890", "جدة - حي الروضة"],
    ];
    for (const [name, mobile, email, nid, addr] of customers) {
      await conn.execute(
        `INSERT INTO CUSTOMERS (FULL_NAME, MOBILE, EMAIL, NATIONAL_ID, ADDRESS, CREATED_BY) VALUES (:1, :2, :3, :4, :5, :6)`,
        [name, mobile, email, nid, addr, "SYSTEM"],
      );
    }
    logger.info("Seeded: CUSTOMERS");
  }

  // Units
  if ((await rowCount(conn, "UNITS")) === 0) {
    const units = [
      ["AND-A-101", "شقة 101 - مبنى A", 1, 1, 1, 1, 120.5, 3, 2, 850000, "AVAILABLE", "شقة فاخرة بإطلالة مميزة"],
      ["AND-A-201", "شقة 201 - مبنى A", 1, 1, 1, 2, 135.0, 3, 2, 920000, "SOLD", "شقة بإطلالة على الحديقة"],
      ["AND-A-301", "دوبلكس 301 - مبنى A", 3, 1, 1, 3, 250.0, 5, 4, 1850000, "AVAILABLE", "دوبلكس فاخر"],
      ["AND-B-101", "شقة 101 - مبنى B", 1, 1, 2, 4, 115.0, 2, 2, 780000, "AVAILABLE", "شقة اقتصادية"],
      ["NAK-1-501", "مكتب 501 - البرج", 4, 2, 3, 6, 200.0, 0, 2, 2500000, "AVAILABLE", "مكتب تجاري بإطلالة على البحر"],
      ["NAK-1-101", "محل B-01 - البرج", 5, 2, 3, 6, 85.0, 0, 1, 650000, "SOLD", "محل تجاري في الطابق التجاري"],
    ];
    for (const [code, name, tid, pid, bid, fid, area, rooms, baths, price, status, desc] of units) {
      await conn.execute(
        `INSERT INTO UNITS (UNIT_CODE, UNIT_NAME, TYPE_ID, PROJECT_ID, BUILDING_ID, FLOOR_ID, AREA, ROOMS, BATHROOMS, PRICE, STATUS, DESCRIPTION, CREATED_BY)
         VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9, :10, :11, :12, :13)`,
        [code, name, tid, pid, bid, fid, area, rooms, baths, price, status, desc, "SYSTEM"],
      );
    }
    logger.info("Seeded: UNITS");
  }

  // Sales for SOLD units
  if ((await rowCount(conn, "SALES")) === 0) {
    // Get unit IDs for SOLD units
    const soldUnits = await conn.execute<[number, string]>(
      `SELECT UNIT_ID, UNIT_CODE FROM UNITS WHERE STATUS = 'SOLD' ORDER BY UNIT_ID`,
    );
    const custResult = await conn.execute<[number]>(`SELECT CUSTOMER_ID FROM CUSTOMERS WHERE ROWNUM <= 2 ORDER BY CUSTOMER_ID`);
    const custs = custResult.rows ?? [];

    if (soldUnits.rows && soldUnits.rows.length > 0 && custs.length > 0) {
      for (let i = 0; i < soldUnits.rows.length; i++) {
        const unitId = soldUnits.rows[i][0];
        const custId = custs[i % custs.length][0];
        await conn.execute(
          `INSERT INTO SALES (UNIT_ID, CUSTOMER_ID, SALE_DATE, SALE_AMOUNT, NOTES, CREATED_BY)
           VALUES (:1, :2, SYSDATE - :3, :4, :5, :6)`,
          [unitId, custId, i * 30, 850000 + i * 70000, "بيع مباشر", "SYSTEM"],
        );
      }
      logger.info("Seeded: SALES");
    }
  }
}
