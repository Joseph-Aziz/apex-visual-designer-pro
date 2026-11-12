# One-step Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importing the plug-in export and adding the region is the whole install: the plug-in creates and upgrades its own tables and packages in the host app's parsing schema.

**Architecture:** The database scripts lose their `&&VD_SCHEMA..` prefixes so one source compiles in any schema. The build packs them into a plug-in file `install/vd-install.sql` and embeds a small bootstrap (`plugin/bootstrap.sql`) as the plug-in's PL/SQL code. The bootstrap installs or upgrades under a lock, registers the host app, then calls `PKG_VD_PLUGIN` dynamically. The separate-schema install stays, with `host_setup.sql` creating a `PKG_VD_PLUGIN` synonym, which tells the bootstrap not to install locally.

**Tech Stack:** Oracle APEX 26.2, PL/SQL, Node (build and unit tests, no dependencies).

**Spec:** `docs/superpowers/specs/2026-11-12-one-step-install-design.md`

## Global Constraints

- APEX 26.2, Oracle Database 19c or later.
- Plug-in name stays `COM.APEXVD.VISUAL_DESIGNER`; component ids stay stable (re-import replaces).
- Release version 1.1.0 (`c_version`, build default, CHANGELOG).
- Runtime API message, exact copy: "Allow page edits: Shared Components > Security Attributes > Runtime API Usage > Modify This Application."
- Do not touch the pilot application, its schema, or the old repo. Live tests use the application and schema the owner names.
- Never enter passwords; the owner logs in.
- Docs and commits in plain prose; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Two first page views at once: exactly one install runs; the other waits and then renders.
2. Parsing schema without CREATE TABLE or CREATE PROCEDURE: the region shows the failing statement number and the ORA error; a retry after the grant completes the install.
3. Importing a newer plug-in over an installed one: the next view upgrades packages, keeps saved versions and registrations.
4. Separate-schema setup (synonym `PKG_VD_PLUGIN` present): the bootstrap installs nothing in the host schema.
5. A plug-in file id or statement marker inside package text (e.g. a comment containing the marker): the split must not cut a package.

---

### Task 1: Spike: can dynamic PL/SQL bind the plug-in callback records?

**Files:**
- Create: `docs/superpowers/notes/2026-11-12-callback-binding-spike.md`

**Interfaces:**
- Produces: the entry shape used by Task 4. Either A) `EXECUTE IMMEDIATE 'begin pkg_vd_plugin.render(:1,:2,:3,:4); end;' USING p_region, p_plugin, p_param, IN OUT p_result` works, or B) a scalar entry `PKG_VD_PLUGIN.render_entry(p_region_id NUMBER, p_attr_01 VARCHAR2, p_attr_02 VARCHAR2, p_attr_03 VARCHAR2, p_file_prefix VARCHAR2, p_ajax_id VARCHAR2)` and `PKG_VD_PLUGIN.ajax_entry(p_attr_01 VARCHAR2)` is needed.

- [ ] **Step 1:** In VD_TEST (SQL Commands), run an anonymous block that declares `apex_plugin.t_region` and binds it into `EXECUTE IMMEDIATE` against a scratch package `VD_SPIKE` that echoes `p_region.id`.
  Expected: either the echoed id (shape A) or PLS-00457/PLS-00382 (shape B).
- [ ] **Step 2:** Record the result and the chosen shape in the note, drop `VD_SPIKE`, commit.

### Task 2: Schema-free database scripts

**Files:**
- Modify: `database/tables/*.sql`, `database/packages/*.sql` (remove every `&&VD_SCHEMA..` prefix; dictionary checks use `USER_TABLES`/`USER_SEQUENCES` instead of `ALL_*` with owner).
- Modify: `database/install.sql` (still takes `VD_SCHEMA HOST_SCHEMA`; must be run connected as `VD_SCHEMA`; drops the `&&VD_SCHEMA` defines inside the included files; grants unchanged).
- Modify: `database/host_setup.sql` (creates synonyms `PKG_VD_PLUGIN` and the other four packages pointing to `VD_SCHEMA`; no `VD_DESIGNER_API`).
- Modify: `database/register_target.sql`, `database/uninstall.sql`, `tests/db/*.sql` to match.
- Create: `database/tables/vd_install.sql`: table `VD_INSTALL(ID NUMBER(1) PRIMARY KEY CHECK (ID=1), VERSION VARCHAR2(20) NOT NULL, INSTALLED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL)`, created only when missing; listed first in `install.sql`.
- Test: `tests/unit/schema_free_test.js`

- [ ] **Step 1: Failing test** `schema_free_test.js`: for every file under `database/tables` and `database/packages`, `assert.ok(!/&&VD_SCHEMA/.test(text), file)`; and `install.sql` includes `@@tables/vd_install.sql` before `@@tables/vd_target_applications.sql`.
- [ ] **Step 2:** `node tests/unit/schema_free_test.js`. Expected: FAIL naming the first file.
- [ ] **Step 3:** Edit the scripts as listed.
- [ ] **Step 4:** Run the test (PASS) and all unit suites (`for f in tests/unit/*.js; do node $f || exit 1; done`), all pass.
- [ ] **Step 5:** Live: run the package and table files (prefix-free) in VD_TEST; all objects VALID; `tests/db/page_code_tests.sql` 40/40, `theme_tests.sql` 20/20, `plugin_api_tests.sql` 4/4. Commit.

### Task 3: Build packs the install payload and bootstrap

**Files:**
- Modify: `tools/build_plugin.js`
- Create: `plugin/bootstrap.sql` (placeholder body until Task 4; must compile as plug-in PL/SQL code: declarations only, no `CREATE`).
- Modify: `tests/unit/build_plugin_test.js`

**Interfaces:**
- Produces: plug-in file `install/vd-install.sql` = the scripts in `install.sql` order (`vd_install`, `vd_target_applications`, `vd_page_code_versions`, `vd_theme_versions`, the five packages), each statement followed by a line exactly `--@@VD_STMT@@` and the trailing `/` lines removed. Plug-in export has `p_plsql_code` = `plugin/bootstrap.sql`, `p_render_function=>'vd_render'`, `p_ajax_function=>'vd_ajax'`, version default `1.1.0`, help text without synonym wording.
- Produces: `wwv_flow_imp.g_varchar2_table`-style CLOB for `p_plsql_code` (use `wwv_flow_string.join(wwv_flow_t_varchar2(...))` with lines quoted by `q()`).

- [ ] **Step 1: Failing test** in `build_plugin_test.js`: replace the two `VD_DESIGNER_API` asserts with `sql.includes(",p_render_function=>'vd_render'")`, `sql.includes(",p_ajax_function=>'vd_ajax'")`, `sql.includes("p_file_name=>'install/vd-install.sql'")`, `sql.includes("p_plsql_code=>")`, `sql.includes("p_version_identifier=>'1.1.0'")`; decode the install file's hex and assert it contains `--@@VD_STMT@@`, contains `CREATE OR REPLACE PACKAGE BODY PKG_VD_PLUGIN`, never contains a line that is only `/`, and that splitting on `\n--@@VD_STMT@@\n` gives no chunk containing both `PACKAGE ` and `END PKG_` of two different packages (Review Focus 5).
- [ ] **Step 2:** Run it. Expected: FAIL on `vd_render`.
- [ ] **Step 3:** Implement. Split rule: a statement ends at a line that is exactly `/`, or at the `;` that ends a top-level `CREATE TABLE`/`CREATE SEQUENCE` outside PL/SQL. The table scripts are anonymous blocks, so every statement in this repo ends at `/`; reject (throw) a file whose text after the last `/` is not blank.
- [ ] **Step 4:** Test PASS; all unit suites pass; `node tools/build_plugin.js` prints 13 files. Commit.

### Task 4: Bootstrap installs, upgrades and dispatches

**Files:**
- Modify: `plugin/bootstrap.sql`
- Modify: `database/packages/pkg_vd_plugin.sql` (entry shape from Task 1; `c_version` 1.1.0; new `PROCEDURE register_host` that inserts the current app into `VD_TARGET_APPLICATIONS` when missing).
- Test: `tests/db/bootstrap_tests.sql`

**Interfaces:**
- Consumes: Task 1 entry shape; Task 3 file name and marker.
- Produces in `bootstrap.sql`: `FUNCTION vd_ensure RETURN VARCHAR2` (NULL on success, else the message), `PROCEDURE vd_render(...)` and `PROCEDURE vd_ajax(...)` with the API-version-2 procedure signatures already used by `PKG_VD_PLUGIN`.

`vd_ensure` order (an algorithm the tests do not fully fix):
1. If `USER_SYNONYMS` has `PKG_VD_PLUGIN`: return NULL (separate-schema mode).
2. If `VD_INSTALL` exists and its version = plug-in `p_plugin.version` (passed in): return NULL.
3. `DBMS_LOCK.REQUEST` on handle from `DBMS_LOCK.ALLOCATE_UNIQUE('VD_INSTALL_' || USER)`, timeout 60s, release on commit = FALSE; re-check step 2 after the lock.
4. Read `install/vd-install.sql` from `APEX_APPL_PLUGIN_FILES` (plug-in `COM.APEXVD.VISUAL_DESIGNER`, current app), split on the marker, `EXECUTE IMMEDIATE` each non-blank chunk. On error: release lock, return `'Install step ' || n || ' failed: ' || SQLERRM`.
5. `MERGE` the version into `VD_INSTALL`; call `pkg_vd_plugin.register_host` dynamically; commit; release lock.

`vd_render`: message non-NULL ⇒ `htp.p` it inside `<p class="vd-denied">` (escaped) and return; else dispatch. `vd_ajax`: message non-NULL ⇒ JSON `{"success":false,"message":...}`.

If `DBMS_LOCK` is not granted to the parsing schema (Task 1 checks with `SELECT 1 FROM ALL_PROCEDURES WHERE OBJECT_NAME='DBMS_LOCK'`), fall back to `LOCK TABLE VD_INSTALL IN EXCLUSIVE MODE` after creating `VD_INSTALL` first as its own step; ledger the ruling.

- [ ] **Step 1: Failing DB test** `tests/db/bootstrap_tests.sql`, run in a fresh test schema (owner names it) with the plug-in imported into a fresh app: 
  - T1 first call installs: after `vd_ensure`, `VD_INSTALL.VERSION = '1.1.0'`, all `PKG_VD_%` VALID, host app row in `VD_TARGET_APPLICATIONS`.
  - T2 second call does no DDL: `USER_OBJECTS.LAST_DDL_TIME` of `PKG_VD_PLUGIN` unchanged.
  - T3 upgrade: set `VERSION='1.0.0'`, insert a row into `VD_PAGE_CODE_VERSIONS`; call; version is 1.1.0 and the row is still there.
  - T4 synonym present: in a schema with synonym `PKG_VD_PLUGIN`, `vd_ensure` returns NULL and creates no `VD_INSTALL`.
  - T5 failure message: with a chunk forced to fail (temporarily rename the plug-in file), the result starts with `Install step`.
- [ ] **Step 2:** Run it against the placeholder bootstrap. Expected: T1 FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun: 5/5 PASS. Two browser tabs opening the region at once both render (Review Focus 1). Commit.

### Task 5: Runtime API message and "Add application"

**Files:**
- Modify: `database/packages/pkg_vd_page_writer.sql` (`import_page` maps `ORA-20987`/"An API call has been prohibited" to `RAISE_APPLICATION_ERROR(-20230, <exact copy from Global Constraints>)`).
- Modify: `database/packages/pkg_vd_plugin.sql` (AJAX part `register`: `g_x01` app id; must be same workspace; calls the logic of `register_target.sql`; returns `{"success":true}` or a message).
- Modify: `plugin/files/js/flutter-mode.js` + `plugin/files/index.html` ("Add application" next to the app field; on success reloads the component list).
- Test: `tests/unit/flutter_add_app_test.js`; `tests/db/plugin_api_tests.sql` gains two cases.

- [ ] **Step 1: Failing tests:** unit test loads `flutter-mode.js` in a vm with a stub `VD.ajax` and asserts that `VD.flutter.addApp(100)` calls the ajax with `x10='register'`, `x01='100'`, and on `{success:false,message:'m'}` shows `m`. DB: register an app of another workspace ⇒ error -20231; register a same-workspace app ⇒ row exists, re-run keeps one row.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** PASS; all unit suites pass; live: with Runtime API Usage off in the test app, a save shows the exact message. Commit.

### Task 6: Docs, version, release

**Files:** `docs/INSTALL.md`, `docs/SECURITY.md`, `docs/USER_GUIDE.md`, `README.md`, `CHANGELOG.md`, `tests/INSTALL_CHECKLIST.md`, `plugin/region_type_plugin_apex_visual_designer.sql` (rebuilt).

- [ ] **Step 1:** INSTALL.md starts with "Quick start": 1) import the export from GitHub, 2) tick Modify This Application, 3) add the region; then requirements (CREATE TABLE, CREATE SEQUENCE, CREATE PROCEDURE on the parsing schema), designing other apps, and "Advanced: separate designer schema" (the current steps, with `host_setup.sql` now creating the package synonyms). SECURITY.md: quick-start objects live in the app schema and run with its rights. CHANGELOG 1.1.0.
- [ ] **Step 2:** `node tools/build_plugin.js`; all unit suites pass; `no_env_values_test` passes. Commit, tag `v1.1.0`, push (owner already asked for pushes of this repo).

### Task 7: Owner's clean test (owner drives)

- [ ] The owner removes the old setup and follows INSTALL.md from the top with the GitHub export. Record the run in `tests/INSTALL_CHECKLIST.md` and fix what it finds.
