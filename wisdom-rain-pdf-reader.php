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
    // PDF.js (3.11.174 – worker ile uyumlu)
    wp_enqueue_script(
        'pdfjs',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        [],
        null,
        true
    );

    // Bizim renderer
    wp_enqueue_script(
        'wrpr-renderer',
        plugin_dir_url( __FILE__ ) . 'assets/js/wrpr-renderer.js',
        [ 'pdfjs' ],
        null,
        true
    );

    // Tek worker tanımı JS içinde yapılıyor (ikinci kez inline eklemiyoruz)
    wp_enqueue_style(
        'wrpr-style',
        plugin_dir_url( __FILE__ ) . 'assets/css/wrpr-style.css',
        [],
        null
    );
}
add_action( 'wp_enqueue_scripts', 'wrpr_enqueue_assets' );
