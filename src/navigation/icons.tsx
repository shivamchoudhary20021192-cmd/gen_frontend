import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import TranslateIcon from '@mui/icons-material/Translate'
import ArticleIcon from '@mui/icons-material/Article'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural'
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn'
import CallSplitIcon from '@mui/icons-material/CallSplit'
import CampaignIcon from '@mui/icons-material/Campaign'
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined'
import CategoryIcon from '@mui/icons-material/Category'
import CircleIcon from '@mui/icons-material/Circle'
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import GroupIcon from '@mui/icons-material/Group'
import GroupsIcon from '@mui/icons-material/Groups'
import HistoryIcon from '@mui/icons-material/History'
import ImportExportIcon from '@mui/icons-material/ImportExport'
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ManageSearchIcon from '@mui/icons-material/ManageSearch'
import MailOutlineIcon from '@mui/icons-material/MailOutlined'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import MenuIcon from '@mui/icons-material/Menu'
import PaymentsIcon from '@mui/icons-material/Payments'
import PeopleIcon from '@mui/icons-material/People'
import PercentIcon from '@mui/icons-material/Percent'
import PermMediaIcon from '@mui/icons-material/PermMedia'
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip'
import PolicyIcon from '@mui/icons-material/Policy'
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer'
import RateReviewIcon from '@mui/icons-material/RateReview'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import ScienceIcon from '@mui/icons-material/Science'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'
import SettingsIcon from '@mui/icons-material/Settings'
import ShieldIcon from '@mui/icons-material/Shield'
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout'
import SmsIcon from '@mui/icons-material/Sms'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import StorefrontIcon from '@mui/icons-material/Storefront'
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel'
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize'
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import WebIcon from '@mui/icons-material/Web'
import AppsIcon from '@mui/icons-material/Apps'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import ExtensionIcon from '@mui/icons-material/Extension'
import LanguageIcon from '@mui/icons-material/Language'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import PaletteIcon from '@mui/icons-material/Palette'
import PublicIcon from '@mui/icons-material/Public'
import type { SvgIconComponent } from '@mui/icons-material'

/**
 * The database stores a logical icon name ('products'), never a component name.
 * Coupling menu rows to one UI library would mean a React rewrite couldn't
 * happen without a data migration — and it would let a bad row crash the
 * sidebar. Anything unmapped falls back to a dot.
 */
const ICONS: Record<string, SvgIconComponent> = {
  dashboard: SpaceDashboardIcon,
  orders: ReceiptLongIcon,
  list: FormatListBulletedIcon,
  cart: ShoppingCartCheckoutIcon,
  returns: AssignmentReturnIcon,
  shipping: LocalShippingIcon,
  invoice: ReceiptLongIcon,
  products: Inventory2Icon,
  inventory: WarehouseIcon,
  category: CategoryIcon,
  collections: CollectionsBookmarkIcon,
  science: ScienceIcon,
  verified: VerifiedUserIcon,
  reviews: RateReviewIcon,
  customers: PeopleIcon,
  segment: GroupsIcon,
  privacy: PrivacyTipIcon,
  policy: PolicyIcon,
  discounts: LocalOfferIcon,
  loyalty: CardGiftcardIcon,
  card_giftcard: CardGiftcardIcon,
  comment: ChatBubbleOutlineIcon,
  subscribers: MarkEmailReadIcon,
  mail: MailOutlineIcon,
  message: SmsIcon,
  content: WebIcon,
  page: WebIcon,
  article: ArticleIcon,
  blog: AutoStoriesIcon,
  creators: FaceRetouchingNaturalIcon,
  sections: ViewQuiltIcon,
  announcement: CampaignIcon,
  banner: CampaignIcon,
  faq: QuestionAnswerIcon,
  menu: MenuIcon,
  redirect: CallSplitIcon,
  media: PermMediaIcon,
  analytics: InsertChartOutlinedIcon,
  search: ManageSearchIcon,
  support: SupportAgentIcon,
  ticket: ConfirmationNumberIcon,
  warning: ReportProblemIcon,
  settings: SettingsIcon,
  store: StorefrontIcon,
  tax: PercentIcon,
  payment: PaymentsIcon,
  staff: GroupIcon,
  shield: ShieldIcon,
  navigation: AccountTreeIcon,
  history: HistoryIcon,
  data: ImportExportIcon,
  merchandising: AutoAwesomeMosaicIcon,
  shelves: ViewCarouselIcon,
  page_builder: DashboardCustomizeIcon,
  billing: CreditCardIcon,
  markets: PublicIcon,
  domains: LanguageIcon,
  integrations: ExtensionIcon,
  notifications_prefs: NotificationsActiveIcon,
  apps: AppsIcon,
  themes: PaletteIcon,
  account: ManageAccountsIcon,
  language: TranslateIcon,
}

export function menuIcon(name: string | null): SvgIconComponent {
  if (!name) return CircleIcon
  return ICONS[name] ?? CircleIcon
}

export const AVAILABLE_ICON_NAMES = Object.keys(ICONS).sort()
