-- Diagnostic: the data types of the page CSS and JavaScript arguments of the page import call.
-- VARCHAR2 means a page takes at most 32,767 characters there; CLOB means no such limit.
-- Run in SQL Commands. Read only.
SELECT owner, argument_name, data_type, data_length
  FROM all_arguments
 WHERE package_name = 'WWV_FLOW_IMP_PAGE'
   AND object_name = 'CREATE_PAGE'
   AND argument_name IN ('P_INLINE_CSS', 'P_JAVASCRIPT_CODE_ONLOAD', 'P_JAVASCRIPT_CODE')
 ORDER BY owner, argument_name;
