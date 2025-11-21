<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WRPR_Shortcode {

    public static function init() {
        add_shortcode( 'wrpr_reader', array( __CLASS__, 'render_reader' ) );
    }

    public static function render_reader( $atts ) {
        $atts = shortcode_atts(
            array(
                'id' => '',
            ),
            $atts
        );

        $reader_id = sanitize_text_field( $atts['id'] );

        if ( empty( $reader_id ) ) {
            return '<p>Invalid reader ID.</p>';
        }

        $readers = get_option( 'wrpr_readers', array() );
        if ( ! isset( $readers[ $reader_id ] ) ) {
            return '<p>Reader not found.</p>';
        }

        $reader = $readers[ $reader_id ];
        $books  = isset( $reader['books'] ) && is_array( $reader['books'] ) ? $reader['books'] : array();

        wp_enqueue_script( 'wrpr-renderer' );
        wp_enqueue_style( 'wrpr-style' );

        // Diller
        $langs = array();
        foreach ( $books as $book ) {
            $language = isset( $book['language'] ) ? $book['language'] : '';
            if ( $language !== '' && ! in_array( $language, $langs, true ) ) {
                $langs[] = $language;
            }
        }

        ob_start();
        ?>
        <div class="wrpr-reader-wrapper" data-reader-id="<?php echo esc_attr( $reader_id ); ?>">
            <div class="wrpr-header">
                <h2><?php echo esc_html( $reader['name'] ); ?></h2>

                <div class="wrpr-header-controls">
                    <select class="wrpr-lang-select">
                        <option value="All">All Languages</option>
                        <?php foreach ( $langs as $lang ) : ?>
                            <option value="<?php echo esc_attr( $lang ); ?>"><?php echo esc_html( $lang ); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>

            <div class="wrpr-book-list">
                <?php foreach ( $books as $book ) :
                    $language = isset( $book['language'] ) ? $book['language'] : '';
                    $title    = isset( $book['title'] ) ? $book['title'] : '';
                    $author   = isset( $book['author'] ) ? $book['author'] : '';
                    $pdf_url  = isset( $book['pdf_url'] ) ? $book['pdf_url'] : '';
                    $buy_link = isset( $book['buy_link'] ) ? $book['buy_link'] : '';
                    ?>
                    <div class="wrpr-book-card no-cover" data-lang="<?php echo esc_attr( $language ); ?>">

                        <div class="wrpr-info">
                            <h4><?php echo esc_html( $title ); ?></h4>
                            <?php if ( ! empty( $author ) ) : ?>
                                <p><?php echo esc_html( $author ); ?></p>
                            <?php endif; ?>
                        </div>

                        <div class="wrpr-actions">
                            <button class="wrpr-read-btn"
                                data-html="<?php echo esc_url( $pdf_url ); ?>"
                                data-reader="<?php echo esc_attr( $reader_id ); ?>">
                                Read PDF
                            </button>

                            <?php if ( ! empty( $buy_link ) ) : ?>
                                <a class="wrpr-buy-link"
                                   href="<?php echo esc_url( $buy_link ); ?>"
                                   target="_blank">Buy Now</a>
                            <?php endif; ?>
                        </div>

                    </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
