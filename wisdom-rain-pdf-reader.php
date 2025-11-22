<?php
/**
 * Plugin Name: Wisdom Rain PDF Reader
 * Plugin URI: https://wisdomrain.com
 * Description: A multilingual PDF reading engine for the Wisdom Rain ecosystem. (WRPR Engine)
 * Version: 1.0
 * Author: Wisdom Rain Team
 * Author URI: https://wisdomrain.com
 * License: GPL2
 * Text Domain: wrpr
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'WRPR_PATH', plugin_dir_path( __FILE__ ) );
define( 'WRPR_URL', plugin_dir_url( __FILE__ ) );

require_once WRPR_PATH . 'includes/wrpr-admin.php';
require_once WRPR_PATH . 'includes/class-wrpr-shortcode.php';
require_once WRPR_PATH . 'includes/class-wrpr-cleaner.php';

function wrpr_init_plugin() {
    wrpr_load_textdomain();

    if ( class_exists( 'WRPR_Admin' ) ) {
        WRPR_Admin::init();
    }

    if ( class_exists( 'WRPR_Shortcode' ) ) {
        WRPR_Shortcode::init();
    }
}
add_action( 'plugins_loaded', 'wrpr_init_plugin' );

function wrpr_load_textdomain() {
    load_plugin_textdomain( 'wrpr', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}

function wrpr_enqueue_assets() {
    wp_enqueue_script(
        'wrpr-renderer',
        plugin_dir_url(__FILE__) . 'assets/js/wrpr-renderer.js',
        [],
        time(), // cache-bypass
        true
    );

    wp_localize_script(
        'wrpr-renderer',
        'wrprCleanerData',
        array(
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'nonce'   => wp_create_nonce( 'wrpr_clean_html' ),
        )
    );

    wp_enqueue_style(
        'font-awesome',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
        [],
        '6.5.0'
    );

    // 3️⃣ Stil dosyası
    wp_enqueue_style(
        'wrpr-style',
        plugin_dir_url(__FILE__) . 'assets/css/wrpr-style.css',
        [],
        time()
    );
}
add_action('wp_enqueue_scripts', 'wrpr_enqueue_assets');

function wrpr_render_viewport_meta() {
    if ( is_admin() ) {
        return;
    }

    echo '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5, user-scalable=yes" />';
}
add_action( 'wp_head', 'wrpr_render_viewport_meta', 1 );

function wrpr_clean_html_ajax() {
    check_ajax_referer( 'wrpr_clean_html', 'nonce' );

    $raw_html = isset( $_POST['html'] ) ? wp_unslash( $_POST['html'] ) : '';
    $cleaned  = WRPR_Cleaner::clean_html( $raw_html );

    wp_send_json_success( $cleaned );
}
add_action( 'wp_ajax_wrpr_clean_html', 'wrpr_clean_html_ajax' );
add_action( 'wp_ajax_nopriv_wrpr_clean_html', 'wrpr_clean_html_ajax' );

function wrpr_render_modal_shell() {
    if ( is_admin() ) {
        return;
    }

    ?>
    <div id="wrpr-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="<?php echo esc_attr__( 'PDF reader', 'wrpr' ); ?>">
        <div id="wrpr-modal-content">
            <button type="button" id="wrpr-close" aria-label="<?php echo esc_attr__( 'Close reader', 'wrpr' ); ?>">&times;</button>
            <div id="wrpr-lang-menu" class="wrpr-lang-menu notranslate">
                <button type="button" class="wrpr-lang-current">
                    <span class="wrpr-lang-flag">
                        <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/en.svg' ); ?>" alt="English">
                    </span>
                    <span class="wrpr-lang-label">English (Original)</span>
                    <span class="wrpr-lang-caret">▾</span>
                </button>

                <div class="wrpr-lang-options">
                    <button type="button" class="wrpr-lang-option" data-lang="en">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/en.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">English (Original)</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="de">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/de.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">German</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="fr">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/fr.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">French</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="it">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/it.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Italian</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="pt">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/pt.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Portuguese</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="tr">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/tr.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Turkish</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="ru">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/ru.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Russian</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="es">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/es.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Spanish</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="hi">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/hi.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Hindi</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="ja">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/ja.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Japanese</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="zh-cn">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/zh-cn.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Chinese (Simplified)</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="no">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/no.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Norwegian</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="ar">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/ar.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Arabic</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="nl">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/nl.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Dutch</span>
                    </button>
                    <button type="button" class="wrpr-lang-option" data-lang="pl">
                        <span class="wrpr-lang-flag">
                            <img src="<?php echo esc_url( WRPR_URL . 'assets/flags/pl.svg' ); ?>" alt="">
                        </span>
                        <span class="wrpr-lang-text">Polish</span>
                    </button>
                </div>
            </div>
            <div id="wrpr-reader-content" class="wrpr-reader-content"></div>
            <div class="wrpr-page-info"><?php echo esc_html__( 'Page 1', 'wrpr' ); ?></div>
            <div class="wrpr-nav">
                <button type="button" id="wrpr-prev" aria-label="<?php echo esc_attr__( 'Previous page', 'wrpr' ); ?>">
                    <i class="fas fa-backward" aria-hidden="true"></i>
                </button>
                <button type="button" id="wrpr-next" aria-label="<?php echo esc_attr__( 'Next page', 'wrpr' ); ?>">
                    <i class="fas fa-forward" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    </div>
    <div id="google_translate_element" style="display:none;"></div>
    <script type="text/javascript">
    function googleTranslateElementInit() {
      new google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'de,fr,it,pt,tr,ru,es,hi,ja,zh-CN,no,ar,nl,pl',
          autoDisplay: false
        },
        'google_translate_element'
      );
    }
    </script>
    <script src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>
    <?php
}
add_action( 'wp_footer', 'wrpr_render_modal_shell' );
