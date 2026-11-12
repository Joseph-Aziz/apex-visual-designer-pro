# Spike: binding plug-in callback records in dynamic PL/SQL

Run on 2026-11-12, APEX 26.2, in SQL Commands as VD_TEST.

- `EXECUTE IMMEDIATE 'begin vd_spike.p(:1, :2); end;' USING l_region, OUT l_text` with
  `l_region apex_plugin.t_region` works: the callee read `id=42 name=spike`.
- Binding `apex_plugin.t_region_render_result` IN and OUT also works.
- Result: shape A. The bootstrap passes `p_region`, `p_plugin`, `p_param` and `p_result` straight
  through to `PKG_VD_PLUGIN.render`/`ajax`; no scalar entry points are needed.

Other findings:

- `DBMS_LOCK` is not visible to the test schemas. The bootstrap uses the plan's fallback:
  create `VD_INSTALL` first, then `LOCK TABLE VD_INSTALL IN EXCLUSIVE MODE`.
- The host app's parsing schema holds CREATE TABLE, CREATE SEQUENCE, CREATE PROCEDURE and CREATE TRIGGER
  directly, and has no object named `VD_%` or `PKG_VD_%` except the old synonym `VD_DESIGNER_API`.
- The scratch package `VD_SPIKE` was dropped.
