"""Training sections can be limited to Organization Types. A section with no
types ticked is shown to everyone. A module whose sections are all hidden for
an organization is hidden too, and so is a course with nothing left to show."""
import json


def item_org_types(ci) -> list:
    try:
        return json.loads(ci.org_types or "[]")
    except (TypeError, ValueError):
        return []


def item_visible(ci, org_type) -> bool:
    types = item_org_types(ci)
    return not types or org_type in types


def visible_items(module, org_type) -> list:
    return [ci for ci in module.content_items if item_visible(ci, org_type)]


def module_visible(module, org_type) -> bool:
    return not module.content_items or bool(visible_items(module, org_type))


def visible_modules(course, org_type) -> list:
    return [m for m in course.modules if module_visible(m, org_type)]


def course_visible(course, org_type) -> bool:
    has_items = any(m.content_items for m in course.modules)
    return not has_items or any(visible_items(m, org_type) for m in course.modules)


def filter_ids(ids, org_map: dict, org_type):
    """For dashboards: keep the content ids visible to org_type. Returns None
    when the list had sections but none are visible (module/course hidden)."""
    kept = [i for i in ids if not org_map.get(i) or org_type in org_map[i]]
    return None if ids and not kept else kept
