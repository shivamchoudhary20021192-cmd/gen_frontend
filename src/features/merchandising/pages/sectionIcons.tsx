import type { SvgIconComponent } from '@mui/icons-material'
import CampaignIcon from '@mui/icons-material/Campaign'
import CollectionsIcon from '@mui/icons-material/Collections'
import ContactMailIcon from '@mui/icons-material/ContactMail'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import ImageIcon from '@mui/icons-material/Image'
import LiveHelpIcon from '@mui/icons-material/LiveHelp'
import NotesIcon from '@mui/icons-material/Notes'
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import SegmentIcon from '@mui/icons-material/Segment'
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag'
import SplitscreenIcon from '@mui/icons-material/Splitscreen'
import VerifiedIcon from '@mui/icons-material/Verified'
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel'
import WidgetsIcon from '@mui/icons-material/Widgets'

/**
 * A glyph per section kind.
 *
 * A list of fifteen rows named "Home — our promise" has to be read; the same
 * list with a glyph per kind is scanned. This is the cheapest legibility win
 * in the builder, and it is why every editor of this shape has them.
 *
 * Keyed by the same `section_key` the API and the storefront use, with a
 * fallback so a kind added to the backend appears with a neutral mark rather
 * than a hole — the admin should never have to ship at the same moment.
 */
export const SECTION_ICONS: Record<string, SvgIconComponent> = {
  hero: ViewCarouselIcon,
  media_products: SplitscreenIcon,
  shelf_embed: ShoppingBagIcon,
  collection_tiles: CollectionsIcon,
  image_text: ImageIcon,
  story_panel: SegmentIcon,
  promises: VerifiedIcon,
  rich_text: NotesIcon,
  quote: FormatQuoteIcon,
  gallery: PhotoLibraryIcon,
  video: OndemandVideoIcon,
  marquee: CampaignIcon,
  faq_embed: LiveHelpIcon,
  newsletter: ContactMailIcon,
  banner_slot: CampaignIcon,
  spacer: HorizontalRuleIcon,
  default: WidgetsIcon,
}
