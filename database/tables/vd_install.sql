-- APEX Visual Designer - installed version marker
-- Installed by database/install.sql into the schema that runs it, or by the plug-in on first use.
-- One row: the plug-in version whose objects are installed in this schema.

DECLARE
  l_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO l_n FROM USER_TABLES WHERE TABLE_NAME = 'VD_INSTALL';
  IF l_n = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE VD_INSTALL (
        ID            NUMBER(1)      DEFAULT 1 NOT NULL,
        VERSION       VARCHAR2(20)   NOT NULL,
        INSTALLED_AT  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT VD_INSTALL_PK PRIMARY KEY (ID),
        CONSTRAINT VD_INSTALL_ONE_CK CHECK (ID = 1)
      )]';
    DBMS_OUTPUT.PUT_LINE('created VD_INSTALL');
  END IF;
END;
/
