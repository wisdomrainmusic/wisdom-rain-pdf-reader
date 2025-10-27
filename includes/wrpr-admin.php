<?php
/**
 * Admin functionality for the Wisdom Rain PDF Reader plugin.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WRPR_Admin {

    /**
     * Bootstrap admin-only functionality.
     *
     * @return void
     */
    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
    }

    /**
     * Register the admin menu page and sub-pages.
     *
     * @return void
     */
    public static function register_menu() {
        add_menu_page(
            __( 'WRPR PDF Engine', 'wrpr' ),
            __( 'WRPR PDF Engine', 'wrpr' ),
            'manage_options',
            'wrpr-overview',
            array( __CLASS__, 'render_overview' ),
            'dashicons-book-alt',
            6
        );

        add_submenu_page(
            'wrpr-overview',
            __( 'Manage Readers', 'wrpr' ),
            __( 'Manage Readers', 'wrpr' ),
            'manage_options',
            'wrpr-manage-readers',
            array( __CLASS__, 'render_manage_readers' )
        );

        add_submenu_page(
            'wrpr-overview',
            __( 'Manage Categories', 'wrpr' ),
            __( 'Manage Categories', 'wrpr' ),
            'manage_options',
            'wrpr-manage-categories',
            array( __CLASS__, 'render_manage_categories' )
        );
    }

    /**
     * Render the overview page content.
     *
     * @return void
     */
    public static function render_overview() {
        $template = trailingslashit( WRPR_PATH ) . 'templates/frontend-reader.php';

        if ( file_exists( $template ) ) {
            include $template;
            return;
        }

        self::output_overview_markup();
    }

    /**
     * Render the manage readers page.
     *
     * @return void
     */
    public static function render_manage_readers() {
        echo '<div class="wrap">';
        echo '<h2>' . esc_html__( 'Manage Readers', 'wrpr' ) . '</h2>';
        echo '<p>' . esc_html__( 'Reader management module will load here.', 'wrpr' ) . '</p>';
        echo '</div>';
    }

    /**
     * Render the manage categories page.
     *
     * @return void
     */
    public static function render_manage_categories() {
        echo '<div class="wrap">';
        echo '<h2>' . esc_html__( 'Manage Categories', 'wrpr' ) . '</h2>';
        echo '<p>' . esc_html__( 'Category management module will load here.', 'wrpr' ) . '</p>';
        echo '</div>';
    }

    /**
     * Output fallback markup if the overview template is missing.
     *
     * @return void
     */
    private static function output_overview_markup() {
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__( 'Wisdom Rain PDF Reader', 'wrpr' ) . '</h1>';
        echo '<p>' . esc_html__( 'Hello WRPR Engine – Plugin successfully loaded.', 'wrpr' ) . '</p>';
        echo '<a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=wrpr-manage-readers' ) ) . '">';
        echo esc_html__( 'Manage Readers', 'wrpr' );
        echo '</a> ';
        echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=wrpr-manage-categories' ) ) . '">';
        echo esc_html__( 'Manage Categories', 'wrpr' );
        echo '</a>';
        echo '</div>';
    }
}
