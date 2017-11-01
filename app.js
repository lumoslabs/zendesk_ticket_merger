(function() {

  var UNMERGEABLE_TICKET_STATUSES = ['closed'];
  var MERGE_READY_TICKET_STATUSES = ['new', 'open'];
  var MERGE_SELECTED_SUCCESS_NOTIFICATIONS = [
    'Total merge. Total Success.',
    'Selected tickets were merged successfully.'
  ];
  // Uses underscore templating to interpolate the values
  // http://underscorejs.org/#template
  var MERGE_INTO_SUCCESS_NOTIFICATIONS = [
    "You just merged <%= ticket_link %> into this ticket. " +
      "I hope your day is as awesome as you are, <%- user_name %>.",
    "<%- user_name %> totally merged <%= ticket_link %> into this ticket!!!<br />" +
      "Did you see that, world? Did you???",
    "You merged <%= ticket_link %> into this ticket.<br />&hearts;",
    "You have merged <%= ticket_link %> into this ticket!<br />" +
      "Always bringing light to this world, <%- user_name %>.",
    "You successfully merged <%= ticket_link %> into this ticket!"
  ];
  var MERGE_OUT_SUCCESS_NOTIFICATIONS = [
    "You just merged this ticket into <%= ticket_link %>. " +
      "I hope your day is as awesome as you are, <%- user_name %>.",
    "<%- user_name %> totally merged this ticket into <%= ticket_link %>!!!<br />" +
      "Did you see that, world? Did you???",
    "You merged this ticket into <%= ticket_link %>.<br />&hearts;",
    "You have merged this ticket into <%= ticket_link %>!" +
      "Always bringing light to this world, <%- user_name %>.",
    "You successfully merged this ticket into <%= ticket_link %>!"
  ];
  var FAILURE_NOTIFICATIONS = [
    "Something went horribly wrong. But it's not your fault.",
    "Something went horribly wrong. Everything's gonna be alright, though."
  ];

  return {
    events: {
      'app.created': 'init',
      'click .btn.show-save': 'enableSaveButton',
      'click .load-comments': 'loadComments',
      'click .toggle-comments': 'toggleComments',
      'click .btn.merge-in:enabled': 'mergeInto',
      'click .btn.merge-out:enabled': 'mergeOut',
      'click .btn.merge-multi': function() {
        this.$('#merge-multi-modal').modal('show');
      },
      'click button.merge-multi-confirm': 'mergeMulti',
      'ticket.save': 'handleSave',
      'click .save-ticket': 'onModalSave',
      'click .fail-ticket': 'onModalCancel',
      'click .hide-app': 'hide',
      'change .merge-checkbox': 'handleCheckboxChanged',
      'click .select-all': 'selectAllCheckboxes',
      'click .select-none': 'selectNoneCheckboxes'
    },

    requests: {
      getTicketsByUser: function(user) {
        return {
          url:  '/api/v2/users/' + user.id() + '/tickets/requested.json?sort_order=desc',
          type: 'GET'
        };
      },
      getCommentsByTicketID: function(ticketID) {
        return {
          url:  '/api/v2/tickets/' + ticketID + '/comments.json',
          type: 'GET'
        };
      },
      getManyUsersByIDs: function(userIDs) {
        return {
          url: '/api/v2/users/show_many.json?ids=' + userIDs.toString(),
          type:'GET'
        };
      },

      mergeTicketsIntoTicket: function(targetID, data) {
        return {
          url: '/api/v2/tickets/' + targetID + '/merge.json',
          type:'POST',
          data: data
        };
      }
    },

    init: function() {
      // hide UI until there are tickets to display
      this.hide();

      var currentTicket = this.ticket();

      // Don't do anything when app loads on unmergable tickets
      if (UNMERGEABLE_TICKET_STATUSES.includes(currentTicket.status())) {
        return;
      }

      // Get user's tickets
      this.ajax('getTicketsByUser', currentTicket.requester())
        .done(function(data){
          // Remove currently viewed ticket from tickets
          // also remove unmergeable tickets from list
          var filteredTickets =  _.reject(data.tickets, function(ticket) {
            return ticket.id == currentTicket.id() || UNMERGEABLE_TICKET_STATUSES.includes(ticket.status);
          });

          // exit if no tickets to display
          if (_.isEmpty(filteredTickets)) { return; }

          //display list of tickets
          this.displayTicketList(filteredTickets, currentTicket);
          this.show();

          // do special stuff if there are tickets with statuses that should be merged
          // (e.g., 'new' or 'open')
          var ticketsNeedMerging = _.some(filteredTickets, function(ticket) {
            return MERGE_READY_TICKET_STATUSES.includes(ticket.status);
          });
          if (ticketsNeedMerging) {
            // display modal at ticket save
            this.showSaveModal = true;
            // add modal to the dom so it can be displayed later
            this.$('.modal-container').html(this.renderTemplate('multi_merge_modal'));
            this.$('.modal-container').after(this.renderTemplate('save_confirm_modal'));
          }
        }).fail(function(){
          this.switchTo('error');
          this.show();
        });
    },

/*
  Tickets and their comments
*/
    displayTicketList: function(tickets, currentTicket) {
      // Order tickets by date descending
      var sortedTickets = _.sortBy(_.flatten(_.values(tickets)), function(ticket) {
        return ticket.created_at;
      }).reverse();

      // add ticket attributes for template
      var formattedTickets = _.map(sortedTickets, function(ticket) {
        ticket.pretty_created_at = moment(ticket.created_at).calendar();
        ticket.status_class = 'status-' + ticket.status;
        ticket.short_status = ticket.status[0]; //first letter
        // ZD won't allow merging solved tickets into other tickets
        // This disables the 'merge #12345 into current ticket' button
        // https://support.zendesk.com/hc/en-us/articles/203690916-Merging-tickets
        if (ticket.status == 'solved') {
          ticket.merge_in_disabled = 'disabled';
          ticket.merge_in_tooltip = "Merging solved tickets into other tickets is not possible";
        }
        // Similar to the above, this disables the 'merge current ticket into #12345'
        // buttons for all tickets in the app UI when viewing a solved ticket
        if (currentTicket.status() == 'solved') {
          ticket.merge_out_disabled = 'disabled';
          ticket.merge_out_tooltip = "Merging solved tickets into other tickets is not possible." +
            "\n(The ticket you are currently viewing is solved.)";
        }
        return ticket;
      });
      this.switchTo('ticket_list', { tickets: formattedTickets });
    },

    loadComments: function(event) {
      var $expandLink = this.$(event.target);
      var ticketID = $expandLink.data('ticket-id');
      var $comments = this.$('.comments[data-ticket-id="' + ticketID + '"]');

      // change link to a toggle link so comments aren't reloaded on next click
      $expandLink.removeClass('load-comments').addClass('toggle-comments')
        .text('Collapse');
      // show spinner in comment area until they load
      $comments.show();

      this.ajax('getCommentsByTicketID', ticketID)
        .done(function(data) {
          $comments.html(this.renderComments(data.comments.reverse()));
        }).fail(function() {
          $comments.html(this.renderTemplate('error'));
        }).always(function() {
          $comments.next('.icon-loading-spinner').hide();
        });
    },

    renderComments: function(comments) {
      comments = _.map(comments, function(comment) {
        comment.pretty_created_at = moment(comment.created_at).calendar();
        return comment;
      });
      this.loadCommentAuthorNames(comments);
      return this.renderTemplate('comments', { comments: comments });
    },

    // asynchronysly add comment author names to DOM
    // (the comment api only returns author ids)
    loadCommentAuthorNames: function(comments) {
      // get all unique author IDs
      var userIDs = _.uniq(
          _.map(comments, function(comment) {
          return comment.author_id;
        })
      );
      // get and add comments to DOM
      this.ajax('getManyUsersByIDs', userIDs)
        .done(function(data) {
          _.each(data.users, function(user) {
            // find comment by the author ID in in template
            var authorsComments = this.$(".comment-author[data-author-id='" + user.id + "']");
            authorsComments.html(user.name);
          });
        }).fail(function(){
          services.notify("Something is messed up and I couldn't load the comment's authors. ¯\\_(ツ)_/¯ ", 'error');
        });
    },

    // show/hide comments, change the text of the link ('expand' or 'collapse')
    toggleComments: function(event) {
      var $toggleLink = this.$(event.target);
      var ticketID = $toggleLink.data('ticket-id');
      var $comments = this.$('.comments[data-ticket-id="' + ticketID + '"]');

      if ($comments.is(':visible')) {
        $toggleLink.text('Expand');
      } else {
        $toggleLink.text('Collapse');
      }
      $comments.toggle();
    },

    // Conditionally displays button which merges multiple tickets
    handleCheckboxChanged:function() {
      if (this.$('.merge-checkbox:checked').length > 0) {
        this.$('.merge-multi').css('display', 'inline-block');
      } else {
        this.$('.merge-multi').hide();
      }
    },

    selectAllCheckboxes: function() {
      this.$('.merge-checkbox:enabled').prop('checked', true);
      this.handleCheckboxChanged();
    },

    selectNoneCheckboxes: function() {
      this.$('.merge-checkbox').prop('checked', false);
      this.handleCheckboxChanged();
    },
/*
  Merging tickets
*/

    // Merge external ticket (i.e., ticket other than current ticket)
    // into current ticket
    mergeInto: function(event) {
      var ticketID = this.$(event.target).data('ticket-id');
      var $ticketItem = this.$('.ticket-item[data-ticket-id="' + ticketID + '"]');
      var tickets = {
        source_tickets: [{ ticket_id: ticketID }],
        targetID: this.ticket().id()
      };
      // replace ticket info with spinner
      $ticketItem.html("<i class='icon-loading-spinner'></i>");
      this.mergeHandler(tickets)
        .done(function() {
           this.mergeOneSuccess(MERGE_INTO_SUCCESS_NOTIFICATIONS, ticketID);
           location.reload();
         }).fail(function() {
           $ticketItem.replaceWith(_.sample(FAILURE_NOTIFICATIONS));
         });
    },

    // Merge current ticket into external ticket
    mergeOut: function(event) {
      var ticketID = this.$(event.target).data('ticket-id');
      var $ticketItem = this.$('.ticket-item[data-ticket-id="' + ticketID + '"]');
      var tickets = {
        source_tickets: [{ ticket_id: this.ticket().id() }],
        targetID: ticketID
      };
      // replace ticket info with spinner
      $ticketItem.html("<i class='icon-loading-spinner'></i>");
      this.mergeHandler(tickets)
       .done(function() {
         this.mergeOneSuccess(MERGE_OUT_SUCCESS_NOTIFICATIONS, ticketID);
         location.reload();
         // also hide other merge buttons, since the current ticket is now closed
         this.$('.merge-in').hide();
         this.$('.merge-out').hide();
       }).fail(function() {
         $ticketItem.replaceWith(_.sample(FAILURE_NOTIFICATIONS));
       });
    },

    // Success callback for single ticket merges; mergeInto or mergeOut
    mergeOneSuccess: function(notificationTemplates, ticketID) {
      var $ticketItem = this.$('.ticket-item[data-ticket-id="' + ticketID + '"]');
      var ticketLink = '<a href="/agent/tickets/' + ticketID + '">#' + ticketID + '</a>';
      // generate a random template using underscore's simple templating system
      var successNotification = _.template(_.sample(notificationTemplates));
      $ticketItem.html(successNotification({
        ticket_link: ticketLink,
        user_name: this.currentUser().name()
      }));
      // hide 'merge selected' button
      this.$('.merge-multi').hide();
    },

    // Merge selected external tickets into current ticket
    mergeMulti: function(event) {
      var $mergeButton = this.$(event.target);
      var $mergeModal = this.$('#merge-multi-modal');
      // Get selected tickets from DOM (in template)
      var selectedTickets = _.map(this.$('.merge-checkbox:checked'), function(el) {
        return { ticket_id: this.$(el).data('ticket-id') };
      });
      var tickets = {
        source_tickets: selectedTickets,
        targetID: this.ticket().id()
      };
      $mergeModal.find('.modal-body').html("<i class='icon-loading-spinner'></i>");
      $mergeButton.hide();
      this.mergeHandler(tickets)
        .done(function() {
          $mergeModal.find('.modal-body').html(_.sample(MERGE_SELECTED_SUCCESS_NOTIFICATIONS));
          location.reload();
          // hide app when user dismisses modal
          $mergeModal.find('.merge-multi-close').addClass('hide-app');
        }).fail(function() {
          $mergeModal.find('.modal-body').html('fail');
        });
    },

    mergeHandler: function(tickets) {
      // turns off save hook, since user is merging at least one ticket
      this.showSaveModal = false;
      // create array of source ticket ids (even if only one is being merged)
      var source_ids = _.map(tickets['source_tickets'], function(sourceTicket) {
        return sourceTicket['ticket_id'];
      });
      // generate merge comment for target via template
      var target_comment = this.renderTemplate('merge_comments_target', {
        source_tickets: tickets['source_tickets']
      });
      var payload = {
        'ids': source_ids,
        'target_comment': target_comment,
        'source_comment': "This ticket was merged into #" + tickets['targetID']
      };
      return this.ajax('mergeTicketsIntoTicket', tickets['targetID'], payload);
    },

/*
  Save Hook
  Intercepts ticket update event unless user has merged tickets
  Shows a confirmation modal
*/

    handleSave: function() {
      // don't show the save modal unless the flag is on
      // returning true will bypass this and save the ticket
      if (!this.showSaveModal) { return true; }

      this.$('#save-confirm-modal').modal({
        backdrop: true,
        keyboard: false
      });
      return this.promise(function(done, fail) {
        this.saveHookDone = done;
        this.saveHookFail = fail;
      }.bind(this));
    },

    onModalSave: function() {
      this.saveHookDone();
    },

    onModalCancel: function() {
      this.saveHookFail('Ticket save cancelled. Go ahead and merge those tickets.');
    },
  };
}());
