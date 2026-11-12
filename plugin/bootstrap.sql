-- Placeholder: the bootstrap is written in Task 4.
PROCEDURE vd_render(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                    p_param IN apex_plugin.t_region_render_param,
                    p_result IN OUT NOCOPY apex_plugin.t_region_render_result) IS
BEGIN
  NULL;
END vd_render;

PROCEDURE vd_ajax(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                  p_param IN apex_plugin.t_region_ajax_param,
                  p_result IN OUT NOCOPY apex_plugin.t_region_ajax_result) IS
BEGIN
  NULL;
END vd_ajax;
