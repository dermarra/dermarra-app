"""Blog post HTML sanitising. Posts come from the admin rich-text editor
and are rendered as HTML on the storefront, so only formatting survives:
no scripts, event handlers, styles, iframes or javascript: links -- an admin
account (now role-based, see app/utils/permissions.py) can't be turned into
stored XSS against shoppers."""
import nh3

_TAGS = {
    "p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
    "a", "ul", "ol", "li", "blockquote", "code", "pre", "img", "figure", "figcaption",
}
_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height"},
}


def clean_html(html):
    return nh3.clean(
        html or "",
        tags=_TAGS,
        attributes=_ATTRIBUTES,
        url_schemes={"https", "http", "mailto"},
        link_rel="noopener noreferrer",
        strip_comments=True,
    )
