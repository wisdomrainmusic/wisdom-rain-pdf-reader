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

function wrpr_init_plugin() {
    wrpr_load_textdomain();

    if ( class_exists( 'WRPR_Admin' ) ) {
        WRPR_Admin::init();
    }
}
add_action( 'plugins_loaded', 'wrpr_init_plugin' );

function wrpr_load_textdomain() {
    load_plugin_textdomain( 'wrpr', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
