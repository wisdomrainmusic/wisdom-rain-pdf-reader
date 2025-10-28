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
    // 1️⃣ PDF.js CDN
    wp_enqueue_script(
        'pdfjs',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        [],
        null,
        true
    );

    // 2️⃣ Renderer JS (bizim PDF okuma motoru)
    wp_enqueue_script(
        'wrpr-renderer',
        plugin_dir_url(__FILE__) . 'assets/js/wrpr-renderer.js',
        ['pdfjs'],
        time(), // cache-bypass
        true
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
